import Image from 'next/image'
import planta from '../../../public/marca/planta.png'

// Foto de refinaria à noite em tons de petróleo (gerada por IA), presa ao pé da faixa escura.
// O topo some num degradê para a rede de luz da Timenow aparecer por cima.
export function PlantaIndustrial({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none [mask-image:linear-gradient(to_bottom,transparent_10%,black_60%)] ${className}`}>
      <Image src={planta} alt="" fill priority sizes="100vw" className="object-cover object-bottom" />
    </div>
  )
}
