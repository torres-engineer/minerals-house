package main

import "core:fmt"
import "core:math"

main :: proc() {}

Vector2 :: [2]f32

Player :: struct {
	pos, dest: Vector2,
	speed:     f32,
}

GameState :: struct {
	player: Player,
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
}
world_width :: 10
world_height :: 10
world_map := [world_width * world_height]u32 {
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
}
world := World {
	width  = world_width,
	height = world_height,
	world  = world_map[:],
	scale  = 64,
	spawn  = Vector2{9, 4},
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
	state.player.dest = pos
}

@(export)
step :: proc(delta_time: f64) -> (keep_going: bool) {
	player := &state.player

	diff := player.dest - player.pos
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	if dist > 0 {
		walk := player.speed * f32(delta_time)
		if walk >= dist {
			if world.world[u32(math.floor(player.dest[1] / f32(world.scale)) * f32(world.width) + math.floor(player.dest[0] / f32(world.scale)))] ==
			   0 {
				player.dest = player.pos
			} else {
				player.pos = player.dest
			}
		} else {
			dir := diff / dist

			new_pos := player.pos + dir * walk
			if world.world[u32(math.floor(new_pos[1] / f32(world.scale)) * f32(world.width) + math.floor(new_pos[0] / f32(world.scale)))] ==
			   0 {
				player.dest = player.pos
			} else {
				player.pos = new_pos
			}
		}
	}

	return true
}
