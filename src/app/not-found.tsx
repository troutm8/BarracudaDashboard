import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        <Link href="/" className="hover:underline">Back home</Link>
      </p>
    </div>
  );
}
