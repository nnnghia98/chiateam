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
        <h1 className="text-4xl font-bold">ChiaTeam Admin</h1>
        <p className="text-gray-600 mt-2">Manage your football team data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="block p-6 bg-white border border-gray-200 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <Icon className="w-12 h-12 mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-gray-600">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
