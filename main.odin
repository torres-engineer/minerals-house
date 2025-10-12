package main

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

@(export)
init :: proc(screen_width, screen_height: u32) {
	center := Vector2{f32(screen_width / 2), f32(screen_height / 2)}
	state.player = Player {
		pos   = center,
		dest  = center,
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
			player.pos = player.dest
		} else {
			dir := diff / dist
			player.pos += dir * walk
		}
	}

	return true
}
