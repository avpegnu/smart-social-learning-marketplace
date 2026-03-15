import { IsInt, Min, Max } from 'class-validator';

export class VoteDto {
  @IsInt()
  @Min(-1)
  @Max(1)
  value!: number; // +1 upvote, -1 downvote, 0 remove
}
