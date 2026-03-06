//    Minerals' House
//    Copyright (C) 2025–2026  Danilo Kymhyr <danilokymhyr3@gmail.com>,
//    Guilherme Pereira <pguilherme926@gmail.com>, João Torres
//    <torres.dev@disroot.org>
//
//    This program is free software: you can redistribute it and/or modify it
//    under the terms of the GNU General Public License as published by the
//    Free Software Foundation, either version 3 of the License, or (at your
//    option) any later version.
//
//    This program is distributed in the hope that it will be useful, but
//    WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
//    Public License for more details.
//
//    You should have received a copy of the GNU General Public License along
//    with this program.  If not, see <https://www.gnu.org/licenses/>.
//
// Native desktop build — uses raylib for window, input, and drawing.

package native

import main "../"
import rl "vendor:raylib"

SCREEN_WIDTH :: 640
SCREEN_HEIGHT :: 480
FPS :: 144

camera: rl.Camera2D
state: ^main.GameState

// Fire up the window and run the game loop until it's closed.
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

// Get the shared game state ready and set up the camera.
init :: proc() {
	main.init(u32(rl.GetScreenWidth()), u32(rl.GetScreenHeight()), 2)
	state = main.getState()

	camera = rl.Camera2D {
		target   = state.player.pos,
		offset   = rl.Vector2{f32(rl.GetScreenWidth() / 2), f32(rl.GetScreenHeight() / 2)},
		rotation = 0,
		zoom     = 1,
	}
}

// Handle player input and advance the game by one frame.
update :: proc() {
	if rl.IsMouseButtonPressed(rl.MouseButton.RIGHT) {
		// Right-click — tell the player where to walk
		main.player_click(rl.GetScreenToWorld2D(rl.GetMousePosition(), camera))
		// rl.CheckCollisionPointRec
	}

	main.step(f64(rl.GetFrameTime()))

	camera.target = state.player.pos
}

// Draw the world, the player, and a little FPS counter.
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
