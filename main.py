"""Minimal pygame-ce Tetris starter structure.

This file is intentionally kept as a single-file prototype. The class and
method boundaries are ready to be split later into modules such as board,
tetromino, and renderer.
"""

from __future__ import annotations

import sys
import random

import pygame


# Window settings
SCREEN_WIDTH = 520
SCREEN_HEIGHT = 600
FPS = 60


# Basic colors
COLOR_BACKGROUND = (18, 18, 24)
COLOR_GRID = (42, 42, 54)
COLOR_TEXT = (230, 230, 240)
COLOR_PANEL = (28, 28, 38)
COLOR_PANEL_BDR = (60, 60, 80)
COLOR_BOARD_BG = (12, 12, 18)


class Tetromino:
    """A falling Tetris piece represented by relative board cells."""

    SHAPES = {
        "I": [(0, 0), (0, 1), (0, 2), (0, 3)],
        "O": [(0, 0), (0, 1), (1, 0), (1, 1)],
        "T": [(0, 1), (1, 0), (1, 1), (1, 2)],
        "S": [(0, 1), (0, 2), (1, 0), (1, 1)],
        "Z": [(0, 0), (0, 1), (1, 1), (1, 2)],
        "J": [(0, 0), (1, 0), (1, 1), (1, 2)],
        "L": [(0, 2), (1, 0), (1, 1), (1, 2)],
    }

    COLORS = {
        "I": (0, 240, 240),
        "O": (240, 240, 0),
        "T": (160, 0, 240),
        "S": (0, 240, 0),
        "Z": (240, 0, 0),
        "J": (0, 0, 240),
        "L": (240, 160, 0),
    }

    _KICKS_JLSTZ_CW = [
        [(0, 0), (0, -1), (+1, -1), (-2, 0), (-2, -1)],
        [(0, 0), (0, +1), (-1, +1), (+2, 0), (+2, +1)],
        [(0, 0), (0, +1), (+1, +1), (-2, 0), (-2, +1)],
        [(0, 0), (0, -1), (-1, -1), (+2, 0), (+2, -1)],
    ]
    _KICKS_JLSTZ_CCW = [
        [(0, 0), (0, +1), (+1, +1), (-2, 0), (-2, +1)],
        [(0, 0), (0, +1), (-1, +1), (+2, 0), (+2, +1)],
        [(0, 0), (0, -1), (+1, -1), (-2, 0), (-2, -1)],
        [(0, 0), (0, -1), (-1, -1), (+2, 0), (+2, -1)],
    ]
    _KICKS_I_CW = [
        [(0, 0), (0, -2), (0, +1), (+1, -2), (-2, +1)],
        [(0, 0), (0, -1), (0, +2), (-2, -1), (+1, +2)],
        [(0, 0), (0, +2), (0, -1), (-1, +2), (+2, -1)],
        [(0, 0), (0, +1), (0, -2), (+2, +1), (-1, -2)],
    ]
    _KICKS_I_CCW = [
        [(0, 0), (0, -1), (0, +2), (-2, -1), (+1, +2)],
        [(0, 0), (0, +2), (0, -1), (-1, +2), (+2, -1)],
        [(0, 0), (0, +1), (0, -2), (+2, +1), (-1, -2)],
        [(0, 0), (0, -2), (0, +1), (+1, -2), (-2, +1)],
    ]

    def __init__(self, shape: str) -> None:
        self.shape = shape
        self.cells = list(self.SHAPES[shape])
        self.color = self.COLORS[shape]
        self.row = 0
        self.col = 3
        self.rotation_state = 0

    def rotated_cells_cw(self) -> list:
        rotated = [(dc, -dr) for dr, dc in self.cells]
        min_r = min(r for r, c in rotated)
        min_c = min(c for r, c in rotated)
        return [(r - min_r, c - min_c) for r, c in rotated]

    def rotated_cells_ccw(self) -> list:
        rotated = [(-dc, dr) for dr, dc in self.cells]
        min_r = min(r for r, c in rotated)
        min_c = min(c for r, c in rotated)
        return [(r - min_r, c - min_c) for r, c in rotated]

    def kicks_cw(self) -> list:
        if self.shape == "I":
            return self._KICKS_I_CW[self.rotation_state]
        if self.shape == "O":
            return [(0, 0)]
        return self._KICKS_JLSTZ_CW[self.rotation_state]

    def kicks_ccw(self) -> list:
        if self.shape == "I":
            return self._KICKS_I_CCW[self.rotation_state]
        if self.shape == "O":
            return [(0, 0)]
        return self._KICKS_JLSTZ_CCW[self.rotation_state]


class Game:
    """Main game controller for setup, loop, updates, and rendering."""

    def __init__(self) -> None:
        """Initialize pygame, the game window, and shared game state."""
        pygame.init()

        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Tetris")

        self.clock = pygame.time.Clock()
        self.running = True

        self.font_title = pygame.font.Font(None, 48)
        self.font_label = pygame.font.Font(None, 20)
        self.font_value = pygame.font.Font(None, 28)
        self.font_over = pygame.font.Font(None, 56)

        # Board layout values are kept here for now.
        # Later these can move into Board and Renderer classes.
        self.board_columns = 10
        self.board_rows = 20
        self.cell_size = 24
        self.board_width = self.board_columns * self.cell_size
        self.board_height = self.board_rows * self.cell_size
        self.board_left = (SCREEN_WIDTH - self.board_width) // 2
        self.board_top = 80
        self.board = [[None] * self.board_columns for _ in range(self.board_rows)]
        self.bag = []
        self.next_queue: list = []
        for _ in range(6):
            self.next_queue.append(self.next_from_bag())
        self.current_piece = self.next_queue.pop(0)
        self.held_piece = None
        self.can_hold = True
        self.score = 0
        self.lines_cleared = 0
        self.level = 1
        self.gravity_timer = 0
        self.gravity_interval = FPS
        self.held_left = False
        self.held_right = False
        self.das_timer = 0
        self.das_delay = 10
        self.arr_timer = 0
        self.arr_rate = 2
        self.lock_delay_frames = 30
        self.lock_timer = 0
        self.lock_resets = 0
        self.max_lock_resets = 15
        self.on_ground = False
        self.soft_drop_held = False
        self.combo = 0
        self.b2b_active = False
        self.last_was_tspin = False
        self.game_over = False
        self.action_text = ""
        self.action_timer = 0
        self.action_max = 90

    def run(self) -> None:
        """Run the main game loop until the player closes the window."""
        while self.running:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)

        self.quit()

    def handle_events(self) -> None:
        """Process pygame events such as window close and keyboard input."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                self.handle_keydown(event.key)
            elif event.type == pygame.KEYUP:
                self.handle_keyup(event.key)

    def handle_keydown(self, key: int) -> None:
        """Handle keyboard input.

        Tetromino movement, rotation, hard drop, and pause logic can be added
        here first, then moved into dedicated input/game-state modules later.
        """
        if self.game_over:
            if key == pygame.K_r:
                self.reset_game()
            elif key == pygame.K_ESCAPE:
                self.running = False
            return

        if key == pygame.K_ESCAPE:
            self.running = False
        elif key == pygame.K_LEFT:
            self.held_left = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, -1):
                self.current_piece.col -= 1
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
        elif key == pygame.K_RIGHT:
            self.held_right = True
            self.das_timer = 0
            self.arr_timer = 0
            if self.can_move(0, 1):
                self.current_piece.col += 1
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
        elif key == pygame.K_DOWN:
            self.soft_drop_held = True
            if self.can_move(1, 0):
                self.current_piece.row += 1
        elif key in (pygame.K_UP, pygame.K_x):
            self.try_rotate_cw()
        elif key in (pygame.K_z, pygame.K_LCTRL, pygame.K_RCTRL):
            self.try_rotate_ccw()
        elif key in (pygame.K_c, pygame.K_LSHIFT, pygame.K_RSHIFT):
            self.hold_piece()
        elif key == pygame.K_SPACE:
            self.hard_drop()

    def handle_keyup(self, key: int) -> None:
        if key == pygame.K_LEFT:
            self.held_left = False
            self.das_timer = 0
            self.arr_timer = 0
        elif key == pygame.K_RIGHT:
            self.held_right = False
            self.das_timer = 0
            self.arr_timer = 0
        elif key == pygame.K_DOWN:
            self.soft_drop_held = False

    def update(self) -> None:
        """Update game state.

        Future gravity timing, collision checks, line clears, scoring, and
        piece spawning should be coordinated from this method.
        """
        if self.action_timer > 0:
            self.action_timer -= 1
        if self.game_over:
            return

        self.gravity_timer += 1
        if self.soft_drop_held:
            sdf_interval = max(1, self.gravity_interval // 20)
            if self.gravity_timer >= sdf_interval:
                self.gravity_timer = 0
                if self.can_move(1, 0):
                    self.current_piece.row += 1
        elif self.gravity_timer >= self.gravity_interval:
            self.gravity_timer = 0
            if self.can_move(1, 0):
                self.current_piece.row += 1

        if self.held_left or self.held_right:
            self.das_timer += 1
            if self.das_timer >= self.das_delay:
                self.arr_timer += 1
                if self.arr_timer >= self.arr_rate:
                    self.arr_timer = 0
                    if self.held_left and self.can_move(0, -1):
                        self.current_piece.col -= 1
                        if not self.can_move(1, 0):
                            self.lock_timer = 0
                            self.lock_resets += 1
                    elif self.held_right and self.can_move(0, 1):
                        self.current_piece.col += 1
                        if not self.can_move(1, 0):
                            self.lock_timer = 0
                            self.lock_resets += 1
        else:
            self.das_timer = 0
            self.arr_timer = 0

        grounded = not self.can_move(1, 0)
        if grounded:
            self.lock_timer += 1
            if self.lock_timer >= self.lock_delay_frames or self.lock_resets >= self.max_lock_resets:
                self.on_ground = False
                self.lock_timer = 0
                self.lock_resets = 0
                self.lock_piece()
                self.spawn_piece()
        else:
            self.on_ground = False
            self.lock_timer = 0

    def can_move(self, dr: int, dc: int) -> bool:
        """Return True if current_piece can move by (dr, dc) without leaving the board."""
        piece = self.current_piece
        return self.can_place(piece.cells, piece.row + dr, piece.col + dc)

    def can_place(self, cells: list, row: int, col: int) -> bool:
        """Return True if cells can be placed at (row, col)."""
        for dr, dc in cells:
            r = row + dr
            c = col + dc
            if r < 0 or r >= self.board_rows:
                return False
            if c < 0 or c >= self.board_columns:
                return False
            if self.board[r][c] is not None:
                return False
        return True

    def lock_piece(self) -> None:
        """Store the active tetromino cells on the board."""
        tspin = self.detect_tspin()

        piece = self.current_piece
        for dr, dc in piece.cells:
            r = piece.row + dr
            c = piece.col + dc
            if 0 <= r < self.board_rows and 0 <= c < self.board_columns:
                self.board[r][c] = piece.color
        self.gravity_timer = 0

        cleared = self.clear_lines()

        if cleared == 0:
            self.combo = 0
            self.last_was_tspin = False
            return

        if tspin == "full":
            base = {1: 800, 2: 1200, 3: 1600}.get(cleared, 1600)
            is_special = True
        elif tspin == "mini":
            base = {1: 200, 2: 400}.get(cleared, 400)
            is_special = True
        else:
            base = {1: 100, 2: 300, 3: 500, 4: 800}.get(cleared, 800)
            is_special = cleared == 4

        b2b_was_active = self.b2b_active
        if is_special and self.b2b_active:
            base = int(base * 1.5)
        self.b2b_active = is_special

        combo_bonus_table = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5]
        combo_bonus = combo_bonus_table[min(self.combo, len(combo_bonus_table) - 1)] * 100
        self.combo += 1

        pc_bonus = 0
        is_pc = all(
            self.board[r][c] is None
            for r in range(self.board_rows)
            for c in range(self.board_columns)
        )
        if is_pc:
            pc_bonus = 1000 * self.level

        self.score += (base + combo_bonus) * self.level + pc_bonus
        self.lines_cleared += cleared
        self.last_was_tspin = tspin != ""
        self.update_level()

        if is_pc:
            label = "ALL CLEAR"
        elif tspin == "full":
            label = {1: "T-SPIN SINGLE", 2: "T-SPIN DOUBLE", 3: "T-SPIN TRIPLE"}.get(cleared, "T-SPIN")
        elif tspin == "mini":
            label = "T-SPIN MINI"
        elif cleared == 4:
            label = "TETRIS"
        elif cleared == 3:
            label = "TRIPLE"
        elif cleared == 2:
            label = "DOUBLE"
        else:
            label = ""

        if label:
            prefix = "B2B " if (is_special and b2b_was_active) else ""
            self.action_text = prefix + label
            self.action_timer = self.action_max

    def detect_tspin(self) -> str:
        if self.current_piece.shape != "T":
            return ""
        cr = self.current_piece.row + 1
        cc = self.current_piece.col + 1
        t_cells = {
            (self.current_piece.row + dr, self.current_piece.col + dc)
            for dr, dc in self.current_piece.cells
        }
        corners = [
            (cr - 1, cc - 1), (cr - 1, cc + 1),
            (cr + 1, cc - 1), (cr + 1, cc + 1),
        ]

        def occupied(r: int, c: int) -> bool:
            if (r, c) in t_cells:
                return True
            if r < 0 or r >= self.board_rows or c < 0 or c >= self.board_columns:
                return True
            return self.board[r][c] is not None

        blocked = sum(1 for r, c in corners if occupied(r, c))
        if blocked < 3:
            return ""
        state = self.current_piece.rotation_state
        if state == 0:
            front = [(cr + 1, cc - 1), (cr + 1, cc + 1)]
        elif state == 1:
            front = [(cr - 1, cc - 1), (cr + 1, cc - 1)]
        elif state == 2:
            front = [(cr - 1, cc - 1), (cr - 1, cc + 1)]
        else:
            front = [(cr - 1, cc + 1), (cr + 1, cc + 1)]
        front_blocked = sum(1 for r, c in front if occupied(r, c))
        return "full" if front_blocked == 2 else "mini"

    def clear_lines(self) -> int:
        """Remove full board rows and return the number of cleared lines."""
        full_rows = [
            r
            for r in range(self.board_rows)
            if all(self.board[r][c] is not None for c in range(self.board_columns))
        ]
        for r in sorted(full_rows, reverse=True):
            del self.board[r]
            self.board.insert(0, [None] * self.board_columns)
        return len(full_rows)

    def update_level(self) -> None:
        """Update level and gravity speed from the total cleared line count."""
        self.level = self.lines_cleared // 10 + 1
        self.gravity_interval = max(6, FPS - (self.level - 1) * 5)

    def next_from_bag(self) -> "Tetromino":
        """Return the next tetromino from a shuffled 7-bag."""
        if not self.bag:
            self.bag = list(Tetromino.SHAPES.keys())
            random.shuffle(self.bag)
        return Tetromino(self.bag.pop())

    def _refill_queue(self) -> None:
        while len(self.next_queue) < 5:
            self.next_queue.append(self.next_from_bag())

    def try_rotate_cw(self) -> None:
        cells = self.current_piece.rotated_cells_cw()
        for dr, dc in self.current_piece.kicks_cw():
            nr = self.current_piece.row + dr
            nc = self.current_piece.col + dc
            if self.can_place(cells, nr, nc):
                self.current_piece.cells = cells
                self.current_piece.row = nr
                self.current_piece.col = nc
                self.current_piece.rotation_state = (self.current_piece.rotation_state + 1) % 4
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
                return

    def try_rotate_ccw(self) -> None:
        cells = self.current_piece.rotated_cells_ccw()
        for dr, dc in self.current_piece.kicks_ccw():
            nr = self.current_piece.row + dr
            nc = self.current_piece.col + dc
            if self.can_place(cells, nr, nc):
                self.current_piece.cells = cells
                self.current_piece.row = nr
                self.current_piece.col = nc
                self.current_piece.rotation_state = (self.current_piece.rotation_state - 1) % 4
                if not self.can_move(1, 0):
                    self.lock_timer = 0
                    self.lock_resets += 1
                return

    def hold_piece(self) -> None:
        if not self.can_hold:
            return
        self.can_hold = False
        shape = self.current_piece.shape
        if self.held_piece is None:
            self.held_piece = Tetromino(shape)
            self.current_piece = self.next_queue.pop(0)
            self._refill_queue()
        else:
            new_cur = self.held_piece
            new_cur.row = 0
            new_cur.col = 3
            new_cur.rotation_state = 0
            new_cur.cells = list(Tetromino.SHAPES[new_cur.shape])
            self.held_piece = Tetromino(shape)
            self.current_piece = new_cur
        self.lock_timer = 0
        self.lock_resets = 0
        self.on_ground = False
        if not self.can_move(0, 0):
            self.game_over = True

    def spawn_piece(self) -> None:
        """Create the next tetromino and stop the game if it cannot spawn."""
        self.can_hold = True
        self.lock_timer = 0
        self.lock_resets = 0
        self.on_ground = False
        self.current_piece = self.next_queue.pop(0)
        self._refill_queue()
        if not self.can_move(0, 0):
            self.game_over = True

    def reset_game(self) -> None:
        self.board = [[None] * self.board_columns for _ in range(self.board_rows)]
        self.bag = []
        self.score = 0
        self.lines_cleared = 0
        self.level = 1
        self.gravity_interval = FPS
        self.gravity_timer = 0
        self.held_left = False
        self.held_right = False
        self.das_timer = 0
        self.arr_timer = 0
        self.soft_drop_held = False
        self.lock_timer = 0
        self.lock_resets = 0
        self.on_ground = False
        self.combo = 0
        self.b2b_active = False
        self.last_was_tspin = False
        self.held_piece = None
        self.can_hold = True
        self.next_queue = []
        for _ in range(6):
            self.next_queue.append(self.next_from_bag())
        self.current_piece = self.next_queue.pop(0)
        self.game_over = False
        self.action_text = ""
        self.action_timer = 0

    def ghost_row(self) -> int:
        """Return the row where the active tetromino would land."""
        row = self.current_piece.row
        while self.can_place(self.current_piece.cells, row + 1, self.current_piece.col):
            row += 1
        return row

    def hard_drop(self) -> None:
        """Drop the active tetromino to its ghost row and lock it."""
        self.current_piece.row = self.ghost_row()
        self.lock_piece()
        self.spawn_piece()

    def draw(self) -> None:
        """Render the current frame."""
        self.screen.fill(COLOR_BACKGROUND)
        title = self.font_title.render("TETRIS", True, COLOR_TEXT)
        self.screen.blit(title, title.get_rect(center=(SCREEN_WIDTH // 2, 42)))
        self.draw_board()
        self.draw_ghost_piece()
        self.draw_action_text()
        self.draw_current_piece()
        self.draw_side_panels()
        if self.game_over:
            self.draw_game_over()

        pygame.display.flip()

    def draw_cell(self, x: int, y: int, color: tuple, size: int = 0) -> None:
        s = size if size > 0 else self.cell_size
        pygame.draw.rect(self.screen, color, (x, y, s - 1, s - 1))
        hi = tuple(min(255, v + 60) for v in color)
        sh = tuple(max(0, v - 60) for v in color)
        pygame.draw.line(self.screen, hi, (x, y), (x + s - 2, y))
        pygame.draw.line(self.screen, hi, (x, y), (x, y + s - 2))
        pygame.draw.line(self.screen, sh, (x + s - 2, y + 1), (x + s - 2, y + s - 2))
        pygame.draw.line(self.screen, sh, (x + 1, y + s - 2), (x + s - 2, y + s - 2))

    def draw_panel(self, x: int, y: int, w: int, h: int) -> None:
        pygame.draw.rect(self.screen, COLOR_PANEL, (x, y, w, h), border_radius=4)
        pygame.draw.rect(
            self.screen,
            COLOR_PANEL_BDR,
            (x, y, w, h),
            width=1,
            border_radius=4,
        )

    def draw_game_over(self) -> None:
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (0, 0))
        cx, cy = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
        title = self.font_over.render("GAME OVER", True, (240, 60, 60))
        score = self.font_value.render(f"SCORE  {self.score}", True, COLOR_TEXT)
        hint = self.font_label.render("R - RESTART        ESC - QUIT", True, (160, 160, 180))
        self.screen.blit(title, title.get_rect(center=(cx, cy - 60)))
        self.screen.blit(score, score.get_rect(center=(cx, cy)))
        self.screen.blit(hint, hint.get_rect(center=(cx, cy + 50)))

    def draw_side_panels(self) -> None:
        cs = 18
        lx, ly, lw, lh = 10, self.board_top, 120, 270
        self.draw_panel(lx, ly, lw, lh)
        for i, (label, value) in enumerate([
            ("SCORE", str(self.score)),
            ("LEVEL", str(self.level)),
            ("LINES", str(self.lines_cleared)),
        ]):
            yb = ly + 16 + i * 48
            self.screen.blit(self.font_label.render(label, True, (130, 130, 160)), (lx + 10, yb))
            self.screen.blit(self.font_value.render(value, True, COLOR_TEXT), (lx + 10, yb + 18))
        hold_label_y = ly + 16 + 3 * 48 + 8
        self.screen.blit(self.font_label.render("HOLD", True, (130, 130, 160)), (lx + 10, hold_label_y))
        if self.held_piece is not None:
            p = self.held_piece
            color = p.color if self.can_hold else tuple(max(0, v - 100) for v in p.color)
            off_x = lx + (lw - 4 * cs) // 2
            off_y = hold_label_y + 18
            for dr, dc in p.cells:
                self.draw_cell(off_x + dc * cs, off_y + dr * cs, color, cs)
        rx = self.board_left + self.board_width + 10
        rw, rh = 120, 350
        ry = self.board_top
        self.draw_panel(rx, ry, rw, rh)
        self.screen.blit(self.font_label.render("NEXT", True, (130, 130, 160)), (rx + 10, ry + 10))
        for i, piece in enumerate(self.next_queue[:5]):
            py = ry + 30 + i * 64
            off_x = rx + (rw - 4 * cs) // 2
            for dr, dc in piece.cells:
                self.draw_cell(off_x + dc * cs, py + dr * cs, piece.color, cs)

    def draw_board(self) -> None:
        """Draw a placeholder Tetris board grid."""
        pygame.draw.rect(
            self.screen,
            COLOR_BOARD_BG,
            (
                self.board_left,
                self.board_top,
                self.board_width,
                self.board_height,
            ),
        )
        pygame.draw.rect(
            self.screen,
            COLOR_PANEL_BDR,
            (
                self.board_left,
                self.board_top,
                self.board_width,
                self.board_height,
            ),
            width=1,
        )

        for column in range(1, self.board_columns):
            x = self.board_left + column * self.cell_size
            pygame.draw.line(
                self.screen,
                COLOR_GRID,
                (x, self.board_top),
                (x, self.board_top + self.board_height),
            )

        for row in range(1, self.board_rows):
            y = self.board_top + row * self.cell_size
            pygame.draw.line(
                self.screen,
                COLOR_GRID,
                (self.board_left, y),
                (self.board_left + self.board_width, y),
            )

        for r in range(self.board_rows):
            for c in range(self.board_columns):
                if self.board[r][c] is not None:
                    self.draw_cell(
                        self.board_left + c * self.cell_size,
                        self.board_top + r * self.cell_size,
                        self.board[r][c],
                    )

    def draw_current_piece(self) -> None:
        """Draw the active tetromino on the board."""
        piece = self.current_piece
        for dr, dc in piece.cells:
            self.draw_cell(
                self.board_left + (piece.col + dc) * self.cell_size,
                self.board_top + (piece.row + dr) * self.cell_size,
                piece.color,
            )

    def draw_ghost_piece(self) -> None:
        """Draw an outline preview of where the active tetromino will land."""
        piece = self.current_piece
        g_row = self.ghost_row()
        if g_row == piece.row:
            return
        for dr, dc in piece.cells:
            x = self.board_left + (piece.col + dc) * self.cell_size
            y = self.board_top + (g_row + dr) * self.cell_size
            rect = pygame.Rect(x, y, self.cell_size - 1, self.cell_size - 1)
            pygame.draw.rect(self.screen, piece.color, rect, width=1)

    def draw_action_text(self) -> None:
        if not self.action_text or self.action_timer <= 0:
            return
        alpha = min(255, self.action_timer * 4)
        font = pygame.font.Font(None, 30)
        surf = font.render(self.action_text, True, (255, 220, 60))
        surf.set_alpha(alpha)
        cx = self.board_left + self.board_width // 2
        cy = self.board_top + self.board_height // 2 - 20
        self.screen.blit(surf, surf.get_rect(center=(cx, cy)))

    def quit(self) -> None:
        """Release pygame resources and exit cleanly."""
        pygame.quit()
        sys.exit()


def main() -> None:
    """Create and start the game."""
    game = Game()
    game.run()


if __name__ == "__main__":
    main()
