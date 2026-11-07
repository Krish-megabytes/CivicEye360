import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useNgoBoard() {
  return useQuery({ queryKey: ['ngo', 'tasks'], queryFn: api.ngo.tasks });
}

export function useNgoLeaderboard() {
  return useQuery({ queryKey: ['ngo', 'leaderboard'], queryFn: api.ngo.leaderboard });
}
