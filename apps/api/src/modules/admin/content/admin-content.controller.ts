import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Inject,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
import { AdminContentService } from './admin-content.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCategoryDto } from '../dto/create-category.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateTagDto } from '../dto/create-tag.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCommissionTierDto } from '../dto/create-commission-tier.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateSettingDto } from '../dto/update-setting.dto';

@Controller('admin')
@ApiTags('Admin — Content')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminContentController {
  constructor(
    @Inject(AdminContentService)
    private readonly service: AdminContentService,
  ) {}

  // --- Categories ---

  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  async updateCategory(@Param('id', ParseCuidPipe) id: string, @Body() dto: CreateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category' })
  async deleteCategory(@Param('id', ParseCuidPipe) id: string) {
    return this.service.deleteCategory(id);
  }

  // --- Tags ---

  @Get('tags')
  @ApiOperation({ summary: 'List all tags (paginated)' })
  async getTags(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getTags({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Post('tags')
  @ApiOperation({ summary: 'Create tag' })
  async createTag(@Body() dto: CreateTagDto) {
    return this.service.createTag(dto);
  }

  @Patch('tags/:id')
  @ApiOperation({ summary: 'Update tag' })
  async updateTag(@Param('id', ParseCuidPipe) id: string, @Body() dto: CreateTagDto) {
    return this.service.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Delete tag' })
  async deleteTag(@Param('id', ParseCuidPipe) id: string) {
    return this.service.deleteTag(id);
  }

  // --- Commission Tiers ---

  @Get('commission-tiers')
  @ApiOperation({ summary: 'List commission tiers' })
  async getCommissionTiers() {
    return this.service.getCommissionTiers();
  }

  @Post('commission-tiers')
  @ApiOperation({ summary: 'Create commission tier' })
  async createCommissionTier(@Body() dto: CreateCommissionTierDto) {
    return this.service.createCommissionTier(dto);
  }

  @Delete('commission-tiers/:id')
  @ApiOperation({ summary: 'Delete commission tier' })
  async deleteCommissionTier(@Param('id', ParseCuidPipe) id: string) {
    return this.service.deleteCommissionTier(id);
  }

  // --- Platform Settings ---

  @Get('settings')
  @ApiOperation({ summary: 'Get all platform settings' })
  async getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update platform setting' })
  async updateSetting(@Body() dto: UpdateSettingDto) {
    return this.service.updateSetting(dto);
  }
}
