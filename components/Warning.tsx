export default function Warning({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {text}
    </div>
  );
}
