type CustomerCardProps = {
    name: string;
    email: string;
    customerSince: string;
    orders: number;
    csat: number;
    location: string;
    device: string;
  };
  
  export default function CustomerCard({
    name,
    email,
    customerSince,
    orders,
    csat,
    location,
    device,
  }: CustomerCardProps) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-6 text-lg font-semibold">Customer</h2>
  
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
            {name.charAt(0)}
          </div>
  
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-zinc-400">{email}</p>
          </div>
        </div>
  
        <div className="mt-6 space-y-4">
  
          <div className="flex justify-between">
            <span className="text-zinc-500">Customer Since</span>
            <span>{customerSince}</span>
          </div>
  
          <div className="flex justify-between">
            <span className="text-zinc-500">Orders</span>
            <span>{orders}</span>
          </div>
  
          <div className="flex justify-between">
            <span className="text-zinc-500">CSAT</span>
            <span>{csat}%</span>
          </div>
  
          <div className="flex justify-between">
            <span className="text-zinc-500">Location</span>
            <span>{location}</span>
          </div>
  
          <div className="flex justify-between">
            <span className="text-zinc-500">Device</span>
            <span>{device}</span>
          </div>
  
        </div>
      </div>
    );
  }