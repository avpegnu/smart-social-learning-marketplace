import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { PostsService } from '../posts/posts.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateGroupDto } from '../dto/create-group.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateGroupDto } from '../dto/update-group.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryGroupsDto } from '../dto/query-groups.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreatePostDto } from '../dto/create-post.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';

@Controller('groups')
@ApiTags('Groups')
export class GroupsController {
  constructor(
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    @Inject(PostsService) private readonly postsService: PostsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public groups' })
  async findAll(@Query() query: QueryGroupsDto, @CurrentUser() user?: JwtPayload) {
    return this.groupsService.findAll(query, user?.sub);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a group' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.sub, dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get group detail' })
  async findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.groupsService.findById(id, user?.sub);
  }

  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update group (owner/admin)' })
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete group (owner only)' })
  async delete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.delete(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/join')
  @ApiOperation({ summary: 'Join a group' })
  async join(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.join(id, user.sub);
  }

  @ApiBearerAuth()
  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a group' })
  async leave(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.groupsService.leave(id, user.sub);
  }

  @Public()
  @Get(':id/members')
  @ApiOperation({ summary: 'List group members' })
  async getMembers(@Param('id', ParseCuidPipe) id: string, @Query() query: PaginationDto) {
    return this.groupsService.getMembers(id, query);
  }

  @ApiBearerAuth()
  @Put(':id/members/:userId')
  @ApiOperation({ summary: 'Change member role (owner/admin)' })
  async updateMemberRole(
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(id, user.sub, targetUserId, dto.role);
  }

  @ApiBearerAuth()
  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Kick member (owner/admin)' })
  async kickMember(
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.kickMember(id, user.sub, targetUserId);
  }

  @ApiBearerAuth()
  @Get(':id/requests')
  @ApiOperation({ summary: 'List pending join requests (owner/admin)' })
  async getJoinRequests(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
  ) {
    return this.groupsService.getJoinRequests(id, user.sub, query);
  }

  @ApiBearerAuth()
  @Put(':id/requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve join request (owner/admin)' })
  async approveJoinRequest(
    @Param('id', ParseCuidPipe) id: string,
    @Param('requestId', ParseCuidPipe) requestId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.approveJoinRequest(id, requestId, user.sub);
  }

  @ApiBearerAuth()
  @Put(':id/requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject join request (owner/admin)' })
  async rejectJoinRequest(
    @Param('id', ParseCuidPipe) id: string,
    @Param('requestId', ParseCuidPipe) requestId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupsService.rejectJoinRequest(id, requestId, user.sub);
  }

  @Public()
  @Get(':id/posts')
  @ApiOperation({ summary: 'Get group posts' })
  async getGroupPosts(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Query() query: PaginationDto,
  ) {
    return this.groupsService.getGroupPosts(id, user?.sub, query);
  }

  @ApiBearerAuth()
  @Post(':id/posts')
  @ApiOperation({ summary: 'Create post in group' })
  async createGroupPost(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePostDto,
  ) {
    dto.groupId = id;
    return this.postsService.create(user.sub, dto);
  }
}
