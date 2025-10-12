package native

import main "../"
import rl "vendor:raylib"

SCREEN_WIDTH :: 640
SCREEN_HEIGHT :: 480
FPS :: 144

camera: rl.Camera2D
state: ^main.GameState

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
	main.init(u32(rl.GetScreenWidth()), u32(rl.GetScreenHeight()))
	state = main.getState()

	camera = rl.Camera2D {
		target   = state.player.pos,
		offset   = rl.Vector2{f32(rl.GetScreenWidth() / 2), f32(rl.GetScreenHeight() / 2)},
		rotation = 0,
		zoom     = 1,
	}
}

update :: proc() {
	if rl.IsMouseButtonPressed(rl.MouseButton.RIGHT) {
		// main.player_click(state.player.pos + (rl.GetMousePosition() - camera.offset))
		main.player_click(rl.GetScreenToWorld2D(rl.GetMousePosition(), camera))

		// rl.CheckCollisionPointRec
	}

	main.step(f64(rl.GetFrameTime()))

	camera.target = state.player.pos
}

draw :: proc() {
	rl.BeginDrawing()

	rl.ClearBackground(rl.Color{0x18, 0x18, 0x18, 0xFF})

	rl.BeginMode2D(camera)

	world := main.getWorld()

	for i in 0 ..< world.width {
		for j in 0 ..< world.height {
			rl.DrawRectangle(
				i32(i * world.scale),
				i32(j * world.scale),
				i32(world.scale),
				i32(world.scale),
				world.world[j * world.width + i] == 1 ? rl.RAYWHITE : rl.BLACK,
			)
		}
	}

	rl.DrawCircleV(state.player.pos, 24, rl.DARKBLUE)

	rl.EndMode2D()

	rl.DrawFPS(8, 8)

	rl.EndDrawing()
}
