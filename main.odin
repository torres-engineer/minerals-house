// The shared gameplay heart of the project — both native and web builds use this.

package main

import "core:fmt"
import "core:math"

main :: proc() {}

Vector2 :: [2]f32

MAX_PATH_LENGTH :: 64

Player :: struct {
	pos, dest:  Vector2,
	speed:      f32,
	// Waypoints the player follows when pathfinding kicks in
	path:       [MAX_PATH_LENGTH]Vector2,
	path_len:   u32,
	path_index: u32,
}

MAX_FOUND_ITEMS :: 16

GameState :: struct {
	player:            Player,
	found_items:       [MAX_FOUND_ITEMS]u8, // Which items the player picked up (0 means empty)
	found_items_count: u32,
}

state: GameState

@(export)
// Hand back the global game state so the host can peek at it.
getState :: proc() -> ^GameState {
	return &state
}

World :: struct {
	width, height: u32,
	world:         []u32,
	scale:         u32,
	spawn:         Vector2,
	exit:          Vector2,
}
// Biggest map we'll ever need
MAX_TILES :: 4096


// Dynamic Map Buffer (filled from JS)
// Size safety: 30x30 = 900 tiles. 4096 is plenty safe.
world_map: [MAX_TILES]u32

world: World

@(export)
set_tile :: proc(index: i32, value: u32) {
	if index >= 0 && index < MAX_TILES {
		world_map[index] = value
	}
}

@(export)
setup_level_config :: proc(w, h: u32, sx, sy, ex, ey: f32) {
	world.width = w
	world.height = h
	world.world = world_map[:]
	world.scale = 48

	// Coordinates from JSON are in Tiles (e.g. 18, 18).
	// Convert to World Pixels (center of tile)

	world.spawn = Vector2{sx, sy} * f32(world.scale) + f32(world.scale / 2)
	world.exit = Vector2{ex, ey} * f32(world.scale) + f32(world.scale / 2)

	// Reset Player to Spawn
	state.player.pos = world.spawn
	state.player.dest = world.spawn
	state.player.path_len = 0
}

init_map :: proc(level_id: i32) {
	// Deprecated in favor of setup_level_config, but kept empty/minimal if needed
}


@(export)
// Gives the host access to the world layout and tile data.
getWorld :: proc() -> ^World {
	return &world
}

@(export)
// Where the exit door sits in the world.
get_exit_pos :: proc() -> ^Vector2 {
	return &world.exit
}

@(export)
// Kicks everything off — loads the map and drops the player at the spawn point.
init :: proc(screen_width, screen_height: u32, level_id: i32) {
	// Map is already loaded via set_tile/setup_level_config

	state.player = Player {
		pos   = world.spawn,
		dest  = world.spawn,
		speed = 120,
	}
	state.found_items_count = 0
}

@(export)
// The player clicked somewhere — figure out how to get there.
player_click :: proc(pos: Vector2) {
	// Forget any path we were following
	state.player.path_len = 0

	// If nothing's in the way, just walk straight there
	if !check_collision(pos) {
		if has_clear_path(state.player.pos, pos) {
			state.player.dest = pos
			return
		}
	}

	// Can't go straight — time for A* pathfinding
	path, path_len := find_path(state.player.pos, pos)

	if path_len > 0 {
		// Clean up the jagged grid path so movement looks smooth
		path, path_len = smooth_path(state.player.pos, path, path_len)

		state.player.path = path
		state.player.path_len = path_len
		state.player.path_index = 0
		// Start walking to the first waypoint
		state.player.dest = state.player.path[0]
	} else {
		// No route? Try a direct walk anyway — wall-sliding might save us
		if !check_collision(pos) {
			state.player.dest = pos
		}
	}
}

// Walk an invisible line between two points to see if anything's blocking the way.
has_clear_path :: proc(from, to: Vector2) -> bool {
	diff := to - from
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	// If it's really close, don't bother checking — collision sliding can handle it
	if dist < 48 {
		return true
	}

	// Step along the line every ~12 px and look for walls
	steps := int(dist / 12)
	if steps < 3 {
		steps = 3
	}

	for i in 1 ..= steps {
		t := f32(i) / f32(steps)
		check_pos := from + diff * t
		if check_collision(check_pos) {
			return false
		}
	}

	return true
}

// Is this spot a wall (or out of bounds)?
is_solid :: proc(pos: Vector2) -> bool {
	x := u32(math.floor(pos.x / f32(world.scale)))
	y := u32(math.floor(pos.y / f32(world.scale)))

	if x >= world.width || y >= world.height {
		return true
	}

	return world.world[y * world.width + x] == 0
}

// Would the player bump into a wall at this position?
// We check the centre plus four edges so the hitbox feels fair.
check_collision :: proc(pos: Vector2) -> bool {
	// Keep this smaller than a tile (48) or the player won't fit through doorways
	collision_radius_x :: 18.0
	collision_radius_y :: 14.0

	// Centre + four cardinal edges
	return(
		is_solid(pos) ||
		is_solid(pos + Vector2{-collision_radius_x, 0}) ||
		is_solid(pos + Vector2{collision_radius_x, 0}) ||
		is_solid(pos + Vector2{0, -collision_radius_y}) ||
		is_solid(pos + Vector2{0, collision_radius_y}) \
	)
}

// Can the player walk on this tile? (used by A*)
is_tile_walkable :: proc(tx, ty: i32) -> bool {
	if tx < 0 || ty < 0 || u32(tx) >= world.width || u32(ty) >= world.height {
		return false
	}
	return world.world[u32(ty) * world.width + u32(tx)] != 0
}

// A* helpers
MAX_OPEN :: 600
PathNode :: struct {
	x, y:   i32,
	g, h:   f32, // g = distance walked so far, h = estimated remaining
	parent: i32, // who we came from (-1 = starting node)
}

// Good old A* — finds a walkable route between two world positions.
// Returns an array of waypoints the player should follow.
find_path :: proc(start_pos, end_pos: Vector2) -> (path: [MAX_PATH_LENGTH]Vector2, path_len: u32) {
	scale := f32(world.scale)

	// Turn pixel coords into tile coords
	start_tx := i32(math.floor(start_pos.x / scale))
	start_ty := i32(math.floor(start_pos.y / scale))
	end_tx := i32(math.floor(end_pos.x / scale))
	end_ty := i32(math.floor(end_pos.y / scale))

	// Can't pathfind from inside a wall
	if !is_tile_walkable(start_tx, start_ty) {
		return
	}

	// Destination is blocked? Find the closest open tile nearby
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

	// Already standing on the target tile
	if start_tx == end_tx && start_ty == end_ty {
		return
	}

	// Classic A* with open/closed lists
	open: [MAX_OPEN]PathNode
	open_count: u32 = 1
	closed: [MAX_OPEN]PathNode
	closed_count: u32 = 0

	// Manhattan distance works well for a grid
	heuristic :: proc(x1, y1, x2, y2: i32) -> f32 {
		return f32(abs(x2 - x1) + abs(y2 - y1))
	}

	// Seed the open list with where we're standing
	open[0] = PathNode {
		x      = start_tx,
		y      = start_ty,
		g      = 0,
		h      = heuristic(start_tx, start_ty, end_tx, end_ty),
		parent = -1,
	}

	// 4 cardinal + 4 diagonal neighbours — diagonals make paths look nicer
	dirs := [8][2]i32{{0, -1}, {1, 0}, {0, 1}, {-1, 0}, {1, -1}, {1, 1}, {-1, 1}, {-1, -1}}
	DIAG_COST :: 1.414 // good old sqrt(2)

	found_goal := false
	goal_closed_idx: i32 = -1

	for open_count > 0 && closed_count < MAX_OPEN - 1 {
		// Pick the most promising node (lowest f = g + h)
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

		// Pop it from the open list (swap-remove for speed)
		open[best_idx] = open[open_count - 1]
		open_count -= 1

		// Mark it as visited
		closed[closed_count] = current
		current_closed_idx := i32(closed_count)
		closed_count += 1

		// Did we make it?
		if current.x == end_tx && current.y == end_ty {
			found_goal = true
			goal_closed_idx = current_closed_idx
			break
		}

		// Look at all the neighbours
		for dir_i in 0 ..< 8 {
			dir := dirs[dir_i]
			nx := current.x + dir[0]
			ny := current.y + dir[1]

			if !is_tile_walkable(nx, ny) {
				continue
			}

			// Don't let diagonals cut through wall corners — that looks weird
			is_diagonal := dir_i >= 4
			if is_diagonal {
				if !is_tile_walkable(current.x + dir[0], current.y) ||
				   !is_tile_walkable(current.x, current.y + dir[1]) {
					continue
				}
			}

			// Skip tiles we've already visited
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

			step_cost: f32 = is_diagonal ? DIAG_COST : 1.0
			new_g := current.g + step_cost

			// Already queued? Just update if this route is shorter
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
				// Found a shortcut?
				if new_g < open[open_idx].g {
					open[open_idx].g = new_g
					open[open_idx].parent = current_closed_idx
				}
			} else if open_count < MAX_OPEN {
				// New tile to explore
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

	// Walk the parent chain backwards to build the route
	temp_path: [MAX_PATH_LENGTH]Vector2
	temp_len: u32 = 0

	idx := goal_closed_idx
	for idx >= 0 && temp_len < MAX_PATH_LENGTH {
		node := closed[idx]
		// Back to pixel coords, landing in the middle of each tile
		temp_path[temp_len] = Vector2 {
			f32(node.x) * scale + scale / 2,
			f32(node.y) * scale + scale / 2,
		}
		temp_len += 1
		idx = node.parent
	}

	// Flip it around (we don't need the starting tile)
	if temp_len > 1 {
		for i in 0 ..< (temp_len - 1) {
			path[i] = temp_path[temp_len - 2 - i]
		}
		path_len = temp_len - 1
	}

	// Snap the last waypoint to exactly where the player clicked
	if path_len > 0 && !check_collision(end_pos) {
		path[path_len - 1] = end_pos
	}

	return
}

// Trims out redundant waypoints so the player doesn't zig-zag like a robot.
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

	// Try to skip as far ahead as we can see — fewer waypoints = smoother walk

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
			// Can't see past anything? Just take the next step
			new_path[new_len] = path[idx]
			new_len += 1
			current = path[idx]
			idx += 1
		}
	}

	return
}

@(export)
// Tick the game forward by one frame — move the player and handle collisions.
step :: proc(delta_time: f64) -> (keep_going: bool) {
	player := &state.player
	start_pos := player.pos

	diff := player.dest - player.pos
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	// Close enough to the current waypoint? Snap and move on
	if dist < 4.0 {
		player.pos = player.dest

		// Still got more waypoints? Head to the next one
		if player.path_len > 0 && player.path_index < player.path_len - 1 {
			player.path_index += 1
			player.dest = player.path[player.path_index]
		} else {
			// We're here!
			player.path_len = 0
		}
		return true
	}

	walk := player.speed * f32(delta_time)

	// About to overshoot? Just land on the destination
	if walk >= dist {
		if !check_collision(player.dest) {
			player.pos = player.dest
			// Next waypoint, please
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

	// Try moving horizontally
	next_x := player.pos + Vector2{move.x, 0}
	if !check_collision(next_x) {
		player.pos = next_x
		moved = true
	}

	// Try moving vertically
	next_y := player.pos + Vector2{0, move.y}
	if !check_collision(next_y) {
		player.pos = next_y
		moved = true
	}

	// Stuck? Skip to the next waypoint or give up
	if !moved && dist > 4.0 {
		if player.path_len > 0 && player.path_index < player.path_len - 1 {
			// Jump ahead to the next waypoint
			player.path_index += 1
			player.dest = player.path[player.path_index]
		} else {
			// Nowhere left to go
			player.path_len = 0
		}
	}

	return true
}

@(export)
// Is the player standing close enough to the exit?
is_near_exit :: proc(threshold: f32) -> bool {
	diff := state.player.pos - world.exit
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)
	return dist <= threshold
}

@(export)
// Player picked up an item — returns true only the first time.
add_found_item :: proc(item_id: u8) -> bool {
	// Already got this one?
	for i in 0 ..< state.found_items_count {
		if state.found_items[i] == item_id {
			return false // Yep, old news
		}
	}
	// Room in the bag?
	if state.found_items_count < MAX_FOUND_ITEMS {
		state.found_items[state.found_items_count] = item_id
		state.found_items_count += 1
		return true // Brand new find!
	}
	return false
}

@(export)
// Have we already picked up this item?
has_found_item :: proc(item_id: u8) -> bool {
	for i in 0 ..< state.found_items_count {
		if state.found_items[i] == item_id {
			return true
		}
	}
	return false
}

@(export)
// How many items has the player found so far?
get_found_items_count :: proc() -> u32 {
	return state.found_items_count
}

@(export)
// Grab the item id at a specific slot (0 if out of range).
get_found_item_at :: proc(index: u32) -> u8 {
	if index < state.found_items_count {
		return state.found_items[index]
	}
	return 0
}
