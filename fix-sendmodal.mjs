import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('components/SendModal.tsx', 'utf8');

// Add props interface and update function signature
c = c.replace(
  `export default function SendModal({ onClose }: { onClose: () => void }) {
  const { wallets } = useWallets();`,
  `export default function SendModal({
  onClose,
  initialToken = "SOL",
  initialTo = "",
  initialAmount = "",
}: {
  onClose: () => void;
  initialToken?: "SOL" | "USDC";
  initialTo?: string;
  initialAmount?: string;
}) {
  const { wallets } = useWallets();`
);

// Use initial values in useState
c = c.replace(
  `  const [tab, setTab] = useState<"SOL" | "USDC">("SOL");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");`,
  `  const [tab, setTab] = useState<"SOL" | "USDC">(initialToken);
  const [to, setTo] = useState(initialTo);
  const [amount, setAmount] = useState(initialAmount);`
);

writeFileSync('components/SendModal.tsx', c);
console.log('Done');
