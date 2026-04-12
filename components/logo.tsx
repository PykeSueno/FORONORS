import Image from 'next/image';

export function Logo() {
  return (
    <div className="mb-8 flex justify-center">
      <Image
        src="/foronors-logo.svg"
        alt="Logo FORONORS"
        width={56}
        height={56}
        priority
        className="h-14 w-14 rounded-xl object-contain"
      />
    </div>
  );
}
