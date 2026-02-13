package main

import "core:encoding/json"
import "core:image"
import "core:image/png"
import "core:io"
import "core:math"
import "core:math/rand"
import "core:os"
import "core:strings"

main :: proc() {}

Vector2 :: [2]f32

TileType :: enum {
	Floor,
	Wall,
	Spawn,
	Exit,
}

Minerals :: struct {
	name:    string,
	origins: []string,
	uses:    []string,
}

Item :: struct {
	name, description: string,
	offset:            Offset,
	minerals:          []string,
}

World_Entry :: struct {
	id:              string,
	config_path:     string,
	mask_path:       string,
	background_path: string,
	overlay_path:    string,
}

World :: struct {
	name:          string,
	width, height: u32,
	scale:         u32,
	mask:          []TileType,
	spawns:        [dynamic]Vector2,
	exits:         [dynamic]Vector2,
	items:         []Item,
	entry:         World_Entry,
}

select_worlds :: proc(
	entries: []World_Entry,
	read_file: proc(path: string) -> ([]byte, bool),
) -> []World {
	worlds := make([dynamic]World, 0, len(entries))

	for e in entries {
		world: World

		if cfg_data, ok := read_file(e.config_path); ok {
			defer delete(cfg_data)
			if err := json.unmarshal(cfg_data, &world); err != nil {
				continue
			}
		}

		world.name = e.id

		mask_bytes, mask_ok := read_file(e.mask_path)
		if !mask_ok {
			continue
		}
		defer delete(mask_bytes)

		mask_img, err := png.load_from_bytes(mask_bytes)
		if err != nil {
			continue
		}
		defer image.destroy(mask_img)

		world.width = u32(mask_img.width)
		world.height = u32(mask_img.height)

		world.mask = make([]TileType, world.width * world.height)

		pix := mask_img.pixels.buf
		bytes_per_pixel := mask_img.channels * (mask_img.depth / 8)
		world.spawns = make([dynamic]Vector2)
		world.exits = make([dynamic]Vector2)

		for y in 0 ..< world.height {
			for x in 0 ..< world.width {
				idx := world.width * y + x

				p := (y * u32(mask_img.width) + x) * u32(bytes_per_pixel)
				r := pix[p + 0]
				g := pix[p + 1]
				b := pix[p + 2]
				a := pix[p + 3]

				if r == 0 && g == 0 && b == 0 && a == 0 {
					world.mask[idx] = .Wall
				} else if r == 0xFF && g == 0xFF && b == 0xFF && a == 0xFF {
					world.mask[idx] = .Floor
				} else if r == 0 && g == 0xFF && b == 0 && a == 0xFF {
					world.mask[idx] = .Spawn
					append(&world.spawns, Vector2{f32(x), f32(y)})
				} else if r == 0xFF && g == 0 && b == 0 && a == 0xFF {
					world.mask[idx] = .Exit
					append(&world.exits, Vector2{f32(x), f32(y)})
				} else {
					world.mask[idx] = .Wall
				}
			}
		}

		world.entry = e

		append(&worlds, world)
	}

	return worlds[:]
}

world: World

@(export)
getWorld :: proc() -> ^World {
	return &world
}

@(export)
init :: proc(
	screen_width, screen_height: u32,
	entries: []World_Entry,
	read_file: proc(path: string) -> ([]byte, bool),
) {
	worlds := select_worlds(entries, read_file)
	if len(worlds) == 0 {
		return
	}

	// TODO: player picks the world
	world = rand.choice(worlds)

	player_radius: f32 = 24.0

	candidates := make([dynamic]Vector2, 0, len(world.spawns))
	defer delete(candidates)

	for spawn in world.spawns {
		spawn_world := (spawn + 0.5) * f32(world.scale)
		if spawn_position_is_safe(spawn_world, player_radius) {
			append(&candidates, spawn_world)
		}
	}

	if len(candidates) == 0 {
		// TODO: workaround and use floor pixels?
		panic("no safe spawn position")
	}

	start := rand.choice(candidates[:])

	state.player = Player {
		pos   = start,
		dest  = start,
		speed = 120,
	}
}

spawn_position_is_safe :: proc(pos: Vector2, radius: f32) -> bool {
	deg_45 := math.sqrt(f32(2)) / 2

	offset := Polygon {
		vertices = []Vector2 {
			Vector2{0, 0},
			Vector2{radius, 0},
			Vector2{-radius, 0},
			Vector2{0, radius},
			Vector2{0, -radius},
			Vector2{radius * deg_45, radius * deg_45},
			Vector2{-radius * deg_45, radius * deg_45},
			Vector2{radius * deg_45, -radius * deg_45},
			Vector2{-radius * deg_45, -radius * deg_45},
		},
	}

	return collision_safe(pos, offset)
}

check_collision :: proc(pos: Vector2) -> bool {
	sx := pos.x / f32(world.scale)
	sy := pos.y / f32(world.scale)

	if sx < 0 || sx >= f32(world.width) || sy < 0 || sy >= f32(world.height) {
		return true
	}

	ix := u32(sx)
	iy := u32(sy)

	return world.mask[iy * world.width + ix] == .Wall
}

MAX_PATH_LENGTH :: 64

Player :: struct {
	pos, dest:  Vector2,
	speed:      f32,
	// A* pathfinding waypoints
	path:       [MAX_PATH_LENGTH]Vector2,
	path_len:   u32,
	path_index: u32,
}

GameState :: struct {
	player:      Player,
	items_found: [dynamic]u32,
}

state: GameState

@(export)
getState :: proc() -> ^GameState {
	return &state
}

@(export)
player_click :: proc(pos: Vector2) {
	// Clear any existing path
	state.player.path_len = 0

	// If destination is valid, check if we can go directly
	if !check_collision(pos) {
		// Check if there's a clear line of sight (no walls in the way)
		if has_clear_path(state.player.pos, pos) {
			// Direct movement - feels more natural
			state.player.dest = pos
			return
		}
	}

	// Path is blocked - use A* pathfinding
	path, path_len := find_path(state.player.pos, pos)

	if path_len > 0 {
		// Smooth the path to remove artifacts of grid-based movement
		path, path_len = smooth_path(state.player.pos, path, path_len)

		// Store the path
		state.player.path = path
		state.player.path_len = path_len
		state.player.path_index = 0
		// Set first waypoint as immediate destination
		state.player.dest = state.player.path[0]
	} else {
		// No path found - try direct movement anyway
		// (the sliding collision will help navigate)
		if !check_collision(pos) {
			state.player.dest = pos
		}
	}
}

// Check if there's a mostly clear path between two points (for deciding when to use A*)
has_clear_path :: proc(from, to: Vector2) -> bool {
	diff := to - from
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	// Short distances are always "clear" - let sliding collision handle it
	if dist < 64 {
		return true
	}

	// Sample points along the line to check for walls
	steps := int(dist / 24) // Check every ~24 pixels
	if steps < 2 {
		steps = 2
	}

	for i in 1 ..< steps {
		t := f32(i) / f32(steps)
		check_pos := from + diff * t
		if check_collision(check_pos) {
			return false // Wall in the way
		}
	}

	return true
}

// Check if a tile is walkable (for A* pathfinding)
is_tile_walkable :: proc(tx, ty: i32) -> bool {
	if tx < 0 || ty < 0 || u32(tx) >= world.width || u32(ty) >= world.height {
		return false
	}
	return world.mask[u32(ty) * world.width + u32(tx)] != .Wall
}

// A* Pathfinding structures
MAX_OPEN :: 256
PathNode :: struct {
	x, y:   i32,
	g, h:   f32, // g = cost from start, h = heuristic to goal
	parent: i32, // index in closed list, -1 if none
}

// Simple A* pathfinding on grid tiles
find_path :: proc(start_pos, end_pos: Vector2) -> (path: [MAX_PATH_LENGTH]Vector2, path_len: u32) {
	scale := f32(world.scale)

	start_tx := i32(math.floor(start_pos.x / scale))
	start_ty := i32(math.floor(start_pos.y / scale))
	end_tx := i32(math.floor(end_pos.x / scale))
	end_ty := i32(math.floor(end_pos.y / scale))

	// If start or end is invalid, return empty path
	if !is_tile_walkable(start_tx, start_ty) {
		return
	}

	// Find nearest walkable tile to destination
	if !is_tile_walkable(end_tx, end_ty) {
		best_dist := f32(1e9)
		found := false
		origin_tx := end_tx
		origin_ty := end_ty
		for dy := i32(-5); dy <= 5; dy += 1 {
			for dx := i32(-5); dx <= 5; dx += 1 {
				tx := origin_tx + dx
				ty := origin_ty + dy
				if is_tile_walkable(tx, ty) {
					d := f32(dx * dx + dy * dy)
					if d < best_dist {
						best_dist = d
						end_tx = tx
						end_ty = ty
						found = true
					}
				}
			}
		}
		if !found {
			return
		}
	}

	// Already at destination
	if start_tx == end_tx && start_ty == end_ty {
		return
	}

	// A* algorithm
	open: [MAX_OPEN]PathNode
	open_count: u32 = 1
	closed: [MAX_OPEN]PathNode
	closed_count: u32 = 0

	// Heuristic: Manhattan distance
	heuristic :: proc(x1, y1, x2, y2: i32) -> f32 {
		return f32(abs(x2 - x1) + abs(y2 - y1))
	}

	// Initialize with start node
	open[0] = PathNode {
		x      = start_tx,
		y      = start_ty,
		g      = 0,
		h      = heuristic(start_tx, start_ty, end_tx, end_ty),
		parent = -1,
	}

	// Direction offsets (4-directional for simpler paths)
	dirs := [4][2]i32{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}

	found_goal := false
	goal_closed_idx: i32 = -1

	for open_count > 0 && closed_count < MAX_OPEN - 1 {
		// Find node with lowest f = g + h
		best_idx: u32 = 0
		best_f := open[0].g + open[0].h
		for i in 1 ..< open_count {
			f := open[i].g + open[i].h
			if f < best_f {
				best_f = f
				best_idx = i
			}
		}

		current := open[best_idx]

		// Remove from open (swap with last)
		open[best_idx] = open[open_count - 1]
		open_count -= 1

		// Add to closed
		closed[closed_count] = current
		current_closed_idx := i32(closed_count)
		closed_count += 1

		// Check if goal reached
		if current.x == end_tx && current.y == end_ty {
			found_goal = true
			goal_closed_idx = current_closed_idx
			break
		}

		// Expand neighbors
		for dir in dirs {
			nx := current.x + dir[0]
			ny := current.y + dir[1]

			if !is_tile_walkable(nx, ny) {
				continue
			}

			// Check if in closed
			in_closed := false
			for i in 0 ..< closed_count {
				if closed[i].x == nx && closed[i].y == ny {
					in_closed = true
					break
				}
			}
			if in_closed {
				continue
			}

			new_g := current.g + 1.0

			// Check if in open
			in_open := false
			open_idx: u32 = 0
			for i in 0 ..< open_count {
				if open[i].x == nx && open[i].y == ny {
					in_open = true
					open_idx = i
					break
				}
			}

			if in_open {
				// Update if better path
				if new_g < open[open_idx].g {
					open[open_idx].g = new_g
					open[open_idx].parent = current_closed_idx
				}
			} else if open_count < MAX_OPEN {
				// Add to open
				open[open_count] = PathNode {
					x      = nx,
					y      = ny,
					g      = new_g,
					h      = heuristic(nx, ny, end_tx, end_ty),
					parent = current_closed_idx,
				}
				open_count += 1
			}
		}
	}

	if !found_goal {
		return
	}

	// Reconstruct path (backwards)
	temp_path: [MAX_PATH_LENGTH]Vector2
	temp_len: u32 = 0

	idx := goal_closed_idx
	for idx >= 0 && temp_len < MAX_PATH_LENGTH {
		node := closed[idx]
		// Convert tile to world coords (center of tile)
		temp_path[temp_len] = Vector2 {
			f32(node.x) * scale + scale / 2,
			f32(node.y) * scale + scale / 2,
		}
		temp_len += 1
		idx = node.parent
	}

	// Reverse path (skip start position)
	if temp_len > 1 {
		for i in 0 ..< (temp_len - 1) {
			path[i] = temp_path[temp_len - 2 - i]
		}
		path_len = temp_len - 1
	}

	// Set final destination to exact end position if walkable
	if path_len > 0 && !check_collision(end_pos) {
		path[path_len - 1] = end_pos
	}

	return
}

// Optimize path by removing unnecessary waypoints (string pulling)
smooth_path :: proc(
	start_pos: Vector2,
	path: [MAX_PATH_LENGTH]Vector2,
	path_len: u32,
) -> (
	new_path: [MAX_PATH_LENGTH]Vector2,
	new_len: u32,
) {
	if path_len == 0 {
		return
	}

	current := start_pos
	last_idx := int(path_len) - 1

	// Start checking from the last node
	// If we can go straight to the end, great. If not, back up one step, etc.

	idx := 0
	for idx <= last_idx {
		found := false
		// Look ahead from current index to the end
		for j := last_idx; j >= idx; j -= 1 {
			if has_clear_path(current, path[j]) {
				new_path[new_len] = path[j]
				new_len += 1
				current = path[j]
				idx = j + 1
				found = true
				break
			}
		}

		if !found {
			// This creates a failsafe, just take the next point
			new_path[new_len] = path[idx]
			new_len += 1
			current = path[idx]
			idx += 1
		}
	}

	return
}

@(export)
step :: proc(delta_time: f64) -> (keep_going: bool) {
	player := &state.player
	start_pos := player.pos

	diff := player.dest - player.pos
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	// Reached current waypoint?
	if dist < 8.0 {
		player.pos = player.dest

		// Advance to next waypoint if following a path
		if player.path_len > 0 && player.path_index < player.path_len - 1 {
			player.path_index += 1
			player.dest = player.path[player.path_index]
		} else {
			// Arrived at final destination
			player.path_len = 0
		}
		return true
	}

	walk := player.speed * f32(delta_time)

	// If step is larger than remaining distance, snap to destination
	if walk >= dist {
		if !check_collision(player.dest) {
			player.pos = player.dest
			// Advance waypoint
			if player.path_len > 0 && player.path_index < player.path_len - 1 {
				player.path_index += 1
				player.dest = player.path[player.path_index]
			} else {
				player.path_len = 0
			}
			return true
		}
		walk = dist
	}

	dir := diff / dist
	move := dir * walk

	moved := false

	// Movement on X axis
	next_x := player.pos + Vector2{move.x, 0}
	if !check_collision(next_x) {
		player.pos = next_x
		moved = true
	}

	// Movement on Y axis
	next_y := player.pos + Vector2{0, move.y}
	if !check_collision(next_y) {
		player.pos = next_y
		moved = true
	}

	// Stuck detection: if we couldn't move at all, try to advance to next waypoint
	// or clear the path entirely
	if !moved && dist > 8.0 {
		if player.path_len > 0 && player.path_index < player.path_len - 1 {
			// Skip current waypoint and try next
			player.path_index += 1
			player.dest = player.path[player.path_index]
		} else {
			// Nothing else to do, clear path
			player.path_len = 0
		}
	}

	return true
}

@(export)
is_near_exit :: proc(threshold: f32) -> bool {
	if len(world.exits) == 0 {
		return false
	}

	closest_dist: f32 = 1e9
	for exit_pos in world.exits {
		diff := state.player.pos - exit_pos
		dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)
		if dist < closest_dist {
			closest_dist = dist
		}
	}
	return closest_dist <= threshold
}

@(export)
get_exit_pos :: proc() -> Vector2 {
	closest: Vector2 = Vector2{0, 0}

	if len(world.exits) == 0 {
		return closest
	}

	closest_dist: f32 = 1e9
	for exit_pos in world.exits {
		diff := state.player.pos - exit_pos
		dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)
		if dist < closest_dist {
			closest_dist = dist
			closest = exit_pos
		}
	}
	return closest
}

@(export)
add_found_item :: proc(item_id: u32) -> bool {
	// Check if already found
	for i in 0 ..< len(state.items_found) {
		if state.items_found[i] == item_id {
			return false // Already found
		}
	}
	append(&state.items_found, item_id)
	return true
}

@(export)
has_found_item :: proc(item_id: u32) -> bool {
	for i in state.items_found {
		if i == item_id {
			return true
		}
	}
	return false
}

@(export)
get_found_items_count :: proc() -> u32 {
	return u32(len(state.items_found))
}

@(export)
get_found_item_at :: proc(index: u32) -> u32 {
	if index < u32(len(state.items_found)) {
		return state.items_found[index]
	}
	return 0
}

Rectangle :: struct {
	pos:  Vector2,
	w, h: f32,
}
Circle :: struct {
	pos: Vector2,
	r:   f32,
}
Polygon :: struct {
	vertices: []Vector2,
}
Offset :: union {
	Rectangle,
	Circle,
	Polygon,
}

collision_safe :: proc {
	rectangle_collision_safe,
	circle_collision_safe,
	polygon_collision_safe,
}

rectangle_collision_safe :: proc(pos: Vector2, rect: Rectangle) -> bool {
	half_w := rect.w * 0.5
	half_h := rect.h * 0.5

	left := rect.pos.x - half_w
	right := rect.pos.x + half_w
	top := rect.pos.y - half_h
	bottom := rect.pos.y + half_h

	return(
		!check_collision(pos) &&
		!check_collision(Vector2{left, rect.pos.y}) &&
		!check_collision(Vector2{right, rect.pos.y}) &&
		!check_collision(Vector2{rect.pos.x, top}) &&
		!check_collision(Vector2{rect.pos.x, bottom}) \
	)
}

circle_collision_safe :: proc(pos: Vector2, circle: Circle) -> bool {
	deg_45 := math.sqrt(f32(2)) / 2

	offsets := []Vector2 {
		Vector2{0, 0},
		Vector2{circle.r, 0},
		Vector2{-circle.r, 0},
		Vector2{0, circle.r},
		Vector2{0, -circle.r},
		Vector2{circle.r * deg_45, circle.r * deg_45},
		Vector2{-circle.r * deg_45, circle.r * deg_45},
		Vector2{circle.r * deg_45, -circle.r * deg_45},
		Vector2{-circle.r * deg_45, -circle.r * deg_45},
	}

	for off in offsets {
		p := pos + off
		if check_collision(p) {
			return false
		}
	}
	return true
}

polygon_collision_safe :: proc(pos: Vector2, poly: Polygon) -> bool {
	if check_collision(pos) {
		return false
	}

	for v in poly.vertices {
		if check_collision(pos + v) {
			return false
		}
	}

	if len(poly.vertices) >= 3 {
		for i in 0 ..< len(poly.vertices) {
			j := (i + 1) % len(poly.vertices)
			mid := (poly.vertices[i] + poly.vertices[j]) * 0.5
			if check_collision(pos + mid) {
				return false
			}
		}
	}

	return true
}
