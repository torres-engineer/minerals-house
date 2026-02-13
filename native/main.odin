package native

import main "../"
import "core:fmt"
import "core:os"
import "core:path/filepath"
import "core:strings"
import rl "vendor:raylib"

SCREEN_WIDTH :: 640
SCREEN_HEIGHT :: 480
FPS :: 144

camera: rl.Camera2D
state: ^main.GameState
world: ^main.World

background_tex: rl.Texture
overlay_tex: rl.Texture

main :: proc() {
	rl.SetConfigFlags(rl.ConfigFlags{.MSAA_4X_HINT})
	rl.InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Minerals' House")
	defer rl.CloseWindow()

	init()
	defer {
		rl.UnloadTexture(background_tex)
		rl.UnloadTexture(overlay_tex)
	}

	rl.SetTargetFPS(FPS)

	for !rl.WindowShouldClose() {
		update()

		draw()
	}
}

init :: proc() {
	entries := discover_worlds()
	defer delete(entries)

	main.init(
		u32(rl.GetScreenWidth()),
		u32(rl.GetScreenHeight()),
		entries,
		proc(path: string) -> ([]byte, bool) {
			data, ok := os.read_entire_file_from_filename(path)
			return data, ok
		},
	)
	state = main.getState()

	camera = rl.Camera2D {
		target   = state.player.pos,
		offset   = rl.Vector2{f32(rl.GetScreenWidth() / 2), f32(rl.GetScreenHeight() / 2)},
		rotation = 0,
		zoom     = 1,
	}

	world = main.getWorld()

	bg_img := rl.LoadImage(strings.clone_to_cstring(world.entry.background_path))
	background_tex = rl.LoadTextureFromImage(bg_img)
	rl.UnloadImage(bg_img)
	ov_img := rl.LoadImage(strings.clone_to_cstring(world.entry.overlay_path))
	overlay_tex = rl.LoadTextureFromImage(ov_img)
	rl.UnloadImage(ov_img)
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

	rl.DrawTextureEx(background_tex, {0, 0}, 0, 1, rl.RAYWHITE)

	rl.DrawCircleV(state.player.pos, 24, rl.DARKBLUE)

	rl.DrawTextureEx(overlay_tex, {0, 0}, 0, 1, rl.RAYWHITE)

	rl.EndMode2D()

	rl.DrawFPS(8, 8)

	rl.EndDrawing()
}

WORLDS_DIR :: "worlds"

discover_worlds :: proc() -> []main.World_Entry {
	entries := make([dynamic]main.World_Entry)

	worlds_dir, err := os.open(WORLDS_DIR)
	if err != os.ERROR_NONE {
		return entries[:]
	}
	defer os.close(worlds_dir)

	fi, ferr := os.read_dir(worlds_dir, 0)
	if ferr != os.ERROR_NONE {
		return entries[:]
	}

	for info in fi {
		if !info.is_dir {
			continue
		}

		base := info.fullpath
		config := filepath.join([]string{base, "config.json"})
		mask := filepath.join([]string{base, "mask.png"})
		background := filepath.join([]string{base, "background.png"})
		overlay := filepath.join([]string{base, "overlay.png"})

		append(
			&entries,
			main.World_Entry {
				id = info.name,
				config_path = filepath.join([]string{base, "config.json"}),
				mask_path = filepath.join([]string{base, "mask.png"}),
				background_path = filepath.join([]string{base, "background.png"}),
				overlay_path = filepath.join([]string{base, "overlay.png"}),
			},
		)
	}

	return entries[:]
}
