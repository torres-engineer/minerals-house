package native

import main "../"
import rl "vendor:raylib"

SCREEN_WIDTH :: 640
SCREEN_HEIGHT :: 480
FPS :: 144

camera: rl.Camera2D
state: main.GameState

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
	state = main.init(u32(rl.GetScreenWidth()), u32(rl.GetScreenHeight()))

	camera = rl.Camera2D {
		target   = state.player.pos,
		offset   = rl.Vector2{f32(rl.GetScreenWidth() / 2), f32(rl.GetScreenHeight() / 2)},
		rotation = 0,
		zoom     = 1,
	}
}

update :: proc() {
	if rl.IsMouseButtonPressed(rl.MouseButton.RIGHT) {
		main.player_click(&state, state.player.pos + (rl.GetMousePosition() - camera.offset))
		main.player_click(&state, rl.GetScreenToWorld2D(rl.GetMousePosition(), camera))

		// rl.CheckCollisionPointRec
	}

	main.update(&state, rl.GetFrameTime())

	camera.target = state.player.pos
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

	rl.DrawCircleV(state.player.pos, 32, rl.DARKBLUE)

	rl.EndMode2D()

	rl.DrawFPS(8, 8)

	rl.EndDrawing()
}
