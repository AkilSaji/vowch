import type { Gig } from './types';

export const demoGigs: Gig[] = [
  { gigId: 'gig-1', title: 'Need help moving a sofa', description: 'A two-person carry from my apartment to the van. Saturday morning.', skill: 'Moving help', mode: 'ONSITE', area: 'Williamsburg, Brooklyn', budgetPaise: 4000, poster: 'Sofia J.', vowches: 8, postedAt: '20m ago', status: 'OPEN' },
  { gigId: 'gig-2', title: 'Dog walker needed', description: 'Walk Miso for 45 minutes this afternoon. Calm neighbourhood route.', skill: 'Pet care', mode: 'ONSITE', area: 'Fort Greene, Brooklyn', budgetPaise: 2500, poster: 'David Chen', vowches: 15, postedAt: '1h ago', status: 'OPEN' },
  { gigId: 'gig-3', title: 'Tutor for high school math', description: 'Patient algebra tutor for two sessions this week.', skill: 'Tutoring', mode: 'REMOTE', area: 'Remote', budgetPaise: 5000, poster: 'Mina S.', vowches: 12, postedAt: '2h ago', status: 'OPEN' }
];
