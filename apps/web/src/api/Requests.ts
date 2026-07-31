import { effectScope } from 'vue';
import { useMutation, useQuery } from '@tanstack/vue-query';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import { apiClient } from './client';
import { queryClient } from './query-client';

export type User = {
  id: string;
  name: string;
  username: string;
};

export type AuthResponse = { user: User; accessToken: string };

export type LoginCredentials = { username: string; password: string };
export type RegisterPayload = LoginCredentials & { name: string };

export type SaveRecord = { id: string; name: string; createdAt: string };

function runMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  variables: TVariables,
): Promise<TData> {
  const scope = effectScope(true);
  const { mutateAsync } = scope.run(() => useMutation({ mutationFn }, queryClient))!;
  return mutateAsync(variables).finally(() => scope.stop());
}

export function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return runMutation(
    (c: LoginCredentials) => apiClient.post<AuthResponse>('/auth/login', c),
    credentials,
  );
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return runMutation(
    (p: RegisterPayload) => apiClient.post<AuthResponse>('/auth/register', p),
    payload,
  );
}

export function fetchHero(): Promise<IHero> {
  return queryClient.fetchQuery({
    queryKey: ['hero', 'me'],
    queryFn: () => apiClient.get<IHero>('/heroes/me'),
  });
}

export function useSavesQuery() {
  return useQuery(
    { queryKey: ['saves'], queryFn: () => apiClient.get<SaveRecord[]>('/saves') },
    queryClient,
  );
}

export function useCreateSaveMutation() {
  return useMutation(
    {
      mutationFn: (name: string) => apiClient.post<SaveRecord>('/saves', { name }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saves'] }),
    },
    queryClient,
  );
}
