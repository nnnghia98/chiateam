import Link from 'next/link';
import { Users, Trophy, Calendar, LayoutDashboard } from 'lucide-react';

export default function Home() {
  const cards = [
    {
      title: 'Dashboard',
      description: 'Overview of all statistics',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Players',
      description: 'Manage player registrations',
      href: '/players',
      icon: Users,
    },
    {
      title: 'Matches',
      description: 'View and edit match records',
      href: '/matches',
      icon: Calendar,
    },
    {
      title: 'Leaderboard',
      description: 'View and modify player statistics',
      href: '/leaderboard',
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#222222] tracking-tight">
          ChiaTeam Admin
        </h1>
        <p className="text-[#6a6a6a] mt-2 text-sm">
          Manage your football team data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="block p-6 bg-white rounded-card shadow-airbnb-card hover:shadow-airbnb-hover transition-shadow"
            >
              <div className="w-12 h-12 mb-4 rounded-full bg-[#f2f2f2] flex items-center justify-center">
                <Icon className="w-6 h-6" style={{ color: '#ff385c' }} />
              </div>
              <h2 className="text-base font-semibold mb-1 text-[#222222]">
                {card.title}
              </h2>
              <p className="text-sm text-[#6a6a6a]">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
