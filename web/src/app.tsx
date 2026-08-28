import SlotMachine from '@/features/game/slot-machine';
import CheckoutWizard from '@/features/checkout/checkout-wizard';

export default function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
      <SlotMachine />
      <CheckoutWizard />
    </main>
  );
}
