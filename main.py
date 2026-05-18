"""Minimal pygame-ce Tetris starter structure.

This file is intentionally kept as a single-file prototype. The class and
method boundaries are ready to be split later into modules such as board,
tetromino, and renderer.
"""

from __future__ import annotations

import sys

import pygame


# Window settings
SCREEN_WIDTH = 400
SCREEN_HEIGHT = 600
FPS = 60


# Basic colors
COLOR_BACKGROUND = (18, 18, 24)
COLOR_GRID = (42, 42, 54)
COLOR_TEXT = (230, 230, 240)


class Game:
    """Main game controller for setup, loop, updates, and rendering."""

    def __init__(self) -> None:
        """Initialize pygame, the game window, and shared game state."""
        pygame.init()

        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Tetris")

        self.clock = pygame.time.Clock()
        self.running = True

        # Placeholder font for early debug/status rendering.
        self.font = pygame.font.Font(None, 32)

        # Board layout values are kept here for now.
        # Later these can move into Board and Renderer classes.
        self.board_columns = 10
        self.board_rows = 20
        self.cell_size = 24
        self.board_width = self.board_columns * self.cell_size
        self.board_height = self.board_rows * self.cell_size
        self.board_left = (SCREEN_WIDTH - self.board_width) // 2
        self.board_top = 80

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

    def handle_keydown(self, key: int) -> None:
        """Handle keyboard input.

        Tetromino movement, rotation, hard drop, and pause logic can be added
        here first, then moved into dedicated input/game-state modules later.
        """
        if key == pygame.K_ESCAPE:
            self.running = False

    def update(self) -> None:
        """Update game state.

        Future gravity timing, collision checks, line clears, scoring, and
        piece spawning should be coordinated from this method.
        """
        # No active gameplay state yet.
        pass

    def draw(self) -> None:
        """Render the current frame."""
        self.screen.fill(COLOR_BACKGROUND)
        self.draw_board()
        self.draw_status_text()

        pygame.display.flip()

    def draw_board(self) -> None:
        """Draw a placeholder Tetris board grid."""
        board_rect = pygame.Rect(
            self.board_left,
            self.board_top,
            self.board_width,
            self.board_height,
        )
        pygame.draw.rect(self.screen, COLOR_GRID, board_rect, width=2)

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

    def draw_status_text(self) -> None:
        """Draw simple placeholder text until gameplay UI is implemented."""
        title_surface = self.font.render("Tetris", True, COLOR_TEXT)
        title_rect = title_surface.get_rect(center=(SCREEN_WIDTH // 2, 40))
        self.screen.blit(title_surface, title_rect)

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
