package main

import rl "vendor:raylib"

SCREEN_WIDTH :: 640
SCREEN_HEIGHT :: 480
FPS :: 144

player: rl.Rectangle
camera: rl.Camera2D
destination: rl.Vector2
speed: f32 = 24

main :: proc() {
	rl.SetConfigFlags(rl.ConfigFlags{.MSAA_4X_HINT})
	rl.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Minerals' House")
	defer rl.CloseWindow()

	init()

	rl.SetTargetFPS(FPS)

	for !rl.WindowShouldClose() {
		update()

		draw()
	}
}

init :: proc() {

	player = rl.Rectangle {
		x      = f32(rl.GetScreenWidth() / 2),
		y      = f32(rl.GetScreenHeight() / 2),
		width  = 32,
		height = 32,
	}

	camera = rl.Camera2D {
		target   = rl.Vector2{player.x, player.y},
		offset   = rl.Vector2{f32(rl.GetScreenWidth() / 2), f32(rl.GetScreenHeight() / 2)},
		rotation = 0,
		zoom     = 1,
	}

	destination = rl.Vector2{player.x, player.y}
}

update :: proc() {
	if rl.IsMouseButtonPressed(rl.MouseButton.RIGHT) {
		destination = rl.Vector2{player.x, player.y} + (rl.GetMousePosition() - camera.offset)

		// rl.CheckCollisionPointRec
	}

	walk := rl.GetFrameTime() * 6 * speed

	if destination.x != player.x {
		diff := destination.x - player.x
		player.x += abs(diff) < walk ? diff : (diff < 0 ? -walk : walk)
	}

	if destination.y != player.y {
		diff := destination.y - player.y
		player.y += abs(diff) < walk ? diff : (diff < 0 ? -walk : walk)
	}

	camera.target = rl.Vector2{player.x, player.y}
}

draw :: proc() {
	rl.BeginDrawing()

	rl.ClearBackground(rl.RAYWHITE)

	rl.BeginMode2D(camera)

	rl.DrawCircleGradient(
		SCREEN_WIDTH / 2,
		SCREEN_HEIGHT / 2,
		SCREEN_HEIGHT / 3,
		rl.GREEN,
		rl.SKYBLUE,
	)

	rl.DrawCircle(i32(player.x), i32(player.y), 32, rl.DARKBLUE)

	rl.EndMode2D()

	rl.DrawFPS(8, 8)

	rl.EndDrawing()
}
