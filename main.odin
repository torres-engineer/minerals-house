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
0,0,1,1,0,0,1,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,
0,0,0,0,0,0,1,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,1,1,1,1,1,1,0,0,
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
	// Se o destino é válido, define direto
	if !check_collision(pos) {
		state.player.dest = pos
		return
	}

	// Se não, busca o ponto válido mais próximo numa área ao redor
	best_dist := f32(1e9)
	found_valid := false
	nearest := pos

	range :: 96 // Busca em ~2 tiles de raio
	step_size :: 12

	for y := -range; y <= range; y += step_size {
		for x := -range; x <= range; x += step_size {
			test_pos := pos + Vector2{f32(x), f32(y)}
			if !check_collision(test_pos) {
				dx := test_pos.x - pos.x
				dy := test_pos.y - pos.y
				d_sq := dx*dx + dy*dy
				if d_sq < best_dist {
					best_dist = d_sq
					nearest = test_pos
					found_valid = true
				}
			}
		}
	}

	if found_valid {
		state.player.dest = nearest
	}
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

@(export)
step :: proc(delta_time: f64) -> (keep_going: bool) {
	player := &state.player
	start_pos := player.pos

	diff := player.dest - player.pos
	dist := math.sqrt(diff.x * diff.x + diff.y * diff.y)

	// Se chegou muito perto, considera que chegou
	if dist < 2.0 {
		player.pos = player.dest
		return true
	}

	walk := player.speed * f32(delta_time)

	// Se o passo é maior que a distância restante, tenta chegar no destino
	if walk >= dist {
		if !check_collision(player.dest) {
			player.pos = player.dest
			return true
		}
		// Se destino final invalido, limita o movimento mas continua tentando deslizar
		walk = dist
	}

	dir := diff / dist
	move := dir * walk

	// Movimento Eixo X
	next_x := player.pos + Vector2{move.x, 0}
	if !check_collision(next_x) {
		player.pos = next_x
	}

	// Movimento Eixo Y
	next_y := player.pos + Vector2{0, move.y}
	if !check_collision(next_y) {
		player.pos = next_y
	}

	return true
}
