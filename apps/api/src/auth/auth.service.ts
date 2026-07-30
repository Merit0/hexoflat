import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginDto, RegisterDto } from './auth.dto';

interface StoredUser {
  id: string;
  username: string;
  password: string;
  name: string;
}

export type PublicUser = Omit<StoredUser, 'password'>;

function toPublicUser(user: StoredUser): PublicUser {
  const { id, username, name } = user;
  return { id, username, name };
}

@Injectable()
export class AuthService {
  private readonly users: StoredUser[] = [];

  register(dto: RegisterDto): PublicUser {
    if (this.users.some((user) => user.username === dto.username)) {
      throw new ConflictException('Username already taken.');
    }
    const user: StoredUser = { id: randomUUID(), ...dto };
    this.users.push(user);
    return toPublicUser(user);
  }

  login(dto: LoginDto): PublicUser {
    const user = this.users.find(
      (candidate) => candidate.username === dto.username && candidate.password === dto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    return toPublicUser(user);
  }
}
