import Image from 'next/image';

export function Logo() {
  return (
    <div className="mb-8 flex justify-center">
      <Image src="/logo.png" alt="Foronors" width={120} height={120} className="h-24 w-24 object-contain" priority />
    </div>
  );
}
