import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import Modal from './modal';

/** Mirrors real usage: a trigger button opens the dialog and gets focus back. */
function Harness({ onClose }: { onClose?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Pay with credit card
      </button>
      {open ? (
        <Modal
          title="Card details"
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <input aria-label="Card number" />
          <input aria-label="CVV" />
          <button type="button">Pay now</button>
        </Modal>
      ) : null}
    </>
  );
}

describe('Modal', () => {
  it('is exposed as a modal dialog with an accessible name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));

    const dialog = screen.getByRole('dialog', { name: 'Card details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));

    expect(screen.getByLabelText('Card number')).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the trigger when it closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /pay with credit card/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(trigger).toHaveFocus();
  });

  it('traps Tab inside the dialog rather than escaping to the page', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));

    const inside = ['Card number', 'CVV'];
    // Walk forward past the last control and confirm focus wraps, never leaving.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      const active = document.activeElement as HTMLElement;
      expect(screen.getByRole('dialog')).toContainElement(active);
    }
    expect(inside.every((label) => screen.getByLabelText(label))).toBe(true);
  });

  it('wraps backwards from the first control with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));

    await user.tab({ shift: true });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes from the explicit close control', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /pay with credit card/i }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
