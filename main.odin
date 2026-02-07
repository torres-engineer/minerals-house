package main

import "core:fmt"
import "core:math"

main :: proc() {}

Vector2 :: [2]f32

MAX_PATH_LENGTH :: 64

Player :: struct {
	pos, dest: Vector2,
	speed:     f32,
	// A* pathfinding waypoints
	path:       [MAX_PATH_LENGTH]Vector2,
	path_len:   u32,
	path_index: u32,
}

MAX_FOUND_ITEMS :: 16

GameState :: struct {
	player:           Player,
	found_items:      [MAX_FOUND_ITEMS]u8, // Item IDs (0 = empty slot)
	found_items_count: u32,
}

state: GameState

@(export)
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
world_width :: 30
world_height :: 20
/**world_map := [world_width * world_height]u32 {
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 1, 1, 0, 1, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 1, 1, 1, 1, 0,
	0, 0, 0, 0, 1, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	0, 1, 1, 1, 1, 1, 1, 1, 1, 0,
	0, 1, 0, 0, 0, 1, 1, 0, 0, 0,
	0, 1, 1, 0, 1, 1, 1, 1, 1, 0,
	0, 1, 1, 1, 1, 1, 1, 1, 1, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
}*/
world_map := [world_width * world_height]u32 {
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,
0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,
0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,
0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0,
0,0,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
0,0,1,1,0,0,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,
0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,
0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
0,0,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,0,
0,0,0,0,0,0,0,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,0,
0,0,0,0,0,0,0,1,1,1,0,0,0,1,1,0,0,0,1,1,0,1,1,1,1,1,1,1,1,0,
0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,1,1,1,1,1,1,1,1,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
}
world := World {
	width  = world_width,
	height = world_height,
	world  = world_map[:],
	scale  = 48,
	spawn  = Vector2{9, 16},
	exit   = Vector2{18, 18} * 48 + 24, // Exit at tile (18,18), centered
}

@(export)
getWorld :: proc() -> ^World {
	return &world
}

@(export)
init :: proc(screen_width, screen_height: u32) {
	state.player = Player {
		pos   = world.spawn * f32(world.scale) + f32(world.scale / 2),
		dest  = world.spawn * f32(world.scale) + f32(world.scale / 2),
		speed = 120,
	}
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
	
	for i in 1..<steps {
		t := f32(i) / f32(steps)
		check_pos := from + diff * t
		if check_collision(check_pos) {
			return false // Wall in the way
		}
	}
	
	return true
}

is_solid :: proc(pos: Vector2) -> bool {
	x := u32(math.floor(pos.x / f32(world.scale)))
	y := u32(math.floor(pos.y / f32(world.scale)))

	if x >= world.width || y >= world.height {
		return true
	}

	return world.world[y * world.width + x] == 0
}

check_collision :: proc(pos: Vector2) -> bool {
	// Raio horizontal para colisão simples (metade da largura do personagem)
	// Usamos 20 (largura total 40) para ser menor que o tile (48) e passar nas portas
	collision_radius :: 20.0 
	
	// Verifica centro, esquerda e direita
	return is_solid(pos) || 
	       is_solid(pos + Vector2{-collision_radius, 0}) || 
	       is_solid(pos + Vector2{collision_radius, 0})
}

// Check if a tile is walkable (for A* pathfinding)
is_tile_walkable :: proc(tx, ty: i32) -> bool {
	if tx < 0 || ty < 0 || u32(tx) >= world.width || u32(ty) >= world.height {
		return false
	}
	return world.world[u32(ty) * world.width + u32(tx)] != 0
}

// A* Pathfinding structures
MAX_OPEN :: 256
PathNode :: struct {
	x, y:   i32,
	g, h:   f32,  // g = cost from start, h = heuristic to goal
	parent: i32,  // index in closed list, -1 if none
}

// Simple A* pathfinding on grid tiles
find_path :: proc(start_pos, end_pos: Vector2) -> (path: [MAX_PATH_LENGTH]Vector2, path_len: u32) {
	scale := f32(world.scale)
	
	// Convert to tile coordinates
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
					d := f32(dx*dx + dy*dy)
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
	open[0] = PathNode{
		x = start_tx, y = start_ty,
		g = 0, h = heuristic(start_tx, start_ty, end_tx, end_ty),
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
		for i in 1..<open_count {
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
			for i in 0..<closed_count {
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
			for i in 0..<open_count {
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
				open[open_count] = PathNode{
					x = nx, y = ny,
					g = new_g,
					h = heuristic(nx, ny, end_tx, end_ty),
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
		temp_path[temp_len] = Vector2{
			f32(node.x) * scale + scale / 2,
			f32(node.y) * scale + scale / 2,
		}
		temp_len += 1
		idx = node.parent
	}
	
	// Reverse path (skip start position)
	if temp_len > 1 {
		for i in 0..<(temp_len - 1) {
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
smooth_path :: proc(start_pos: Vector2, path: [MAX_PATH_LENGTH]Vector2, path_len: u32) -> (new_path: [MAX_PATH_LENGTH]Vector2, new_len: u32) {
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
	diff := state.player.pos - world.exit
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)
	return dist <= threshold
}

@(export)
get_exit_pos :: proc() -> Vector2 {
	return world.exit
}

@(export)
add_found_item :: proc(item_id: u8) -> bool {
	// Check if already found
	for i in 0..<state.found_items_count {
		if state.found_items[i] == item_id {
			return false // Already found
		}
	}
	// Add if space available
	if state.found_items_count < MAX_FOUND_ITEMS {
		state.found_items[state.found_items_count] = item_id
		state.found_items_count += 1
		return true // Newly found
	}
	return false
}

@(export)
has_found_item :: proc(item_id: u8) -> bool {
	for i in 0..<state.found_items_count {
		if state.found_items[i] == item_id {
			return true
		}
	}
	return false
}

@(export)
get_found_items_count :: proc() -> u32 {
	return state.found_items_count
}

@(export)
get_found_item_at :: proc(index: u32) -> u8 {
	if index < state.found_items_count {
		return state.found_items[index]
	}
	return 0
}
