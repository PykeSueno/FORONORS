import Image from 'next/image';

export function BrandLogo() {
  return <Image src="/foronors-logo.svg" alt="Logo FORONORS" width={120} height={36} priority />;
}
