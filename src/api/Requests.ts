import { IHero } from "@/abstraction/IHero";

export type User = {
  name: string;
  username: string;
  loggedIn: boolean;
  id: number;
};
export type UserList = Array<User & { password: string }>;
export type HeroList = Array<IHero>;

export async function login(username: string, password: string) {
  const request = await fetch("/users.json");
  const usersJson: UserList = await request.json();
  return usersJson.find(
    (user) => user.password === password && user.username === username
  );
}

export async function getUser() {
  const request = await fetch("/current.json");
  const user: User = await request.json();
  return user;
}

export async function getHero(id: number) {
  const request = await fetch("/heroes.json");
  const heroesJson: HeroList = await request.json();
  return heroesJson.find((hero) => hero.id === id);
}
