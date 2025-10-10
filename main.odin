package main

import "core:math"
Vector2 :: [2]f32

Player :: struct {
	pos, dest: Vector2,
	speed:     f32,
}

GameState :: struct {
	player: Player,
}

init :: proc(screen_width, screen_height: u32) -> GameState {
	center := Vector2{f32(screen_width / 2), f32(screen_height / 2)}
	player := Player {
		pos   = center,
		dest  = center,
		speed = 120,
	}
	return GameState{player}
}

player_click :: proc(state: ^GameState, pos: Vector2) {
	state.player.dest = pos
}

update :: proc(state: ^GameState, dt: f32) {
	player := &state.player

	diff := player.dest - player.pos
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

    if dist > 0 {
        walk := player.speed * dt
        if walk >= dist {
            player.pos = player.dest
        } else {
            dir := diff / dist
            player.pos += dir * walk
        }
    }
}
