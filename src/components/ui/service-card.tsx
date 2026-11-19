import { Link } from 'react-router-dom'
import { ArrowUpRight } from '../../icons/iconoir'
export function ServiceCard({title,description,to,imgSrc,variant='default'}:{title:string;description:string;to:string;imgSrc:string;variant?:string}) {
  return <Link to={to} className={`service-card service-card-${variant}`}><div><h3>{title}</h3><p>{description}</p></div><span>Abrir <ArrowUpRight size={16}/></span><img src={imgSrc} alt="" aria-hidden="true" loading="lazy"/></Link>
}
