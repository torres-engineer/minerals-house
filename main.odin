package main

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
	walk := state.player.speed * dt

	diff := state.player.dest - state.player.pos

	if abs(diff.x) < walk {
		state.player.pos.x = state.player.dest.x
	} else {
		state.player.pos.x += walk * (diff.x >= 0 ? 1 : -1)
	}
	if abs(diff.y) < walk {
		state.player.pos.y = state.player.dest.y
	} else {
		state.player.pos.y += walk * (diff.y >= 0 ? 1 : -1)}
}
