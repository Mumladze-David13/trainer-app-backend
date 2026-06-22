import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@ApiTags('Chat')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Получить список диалогов текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Список диалогов с последним сообщением' })
  getConversations(@CurrentUser() user: { id: string }) {
    return this.chatService.getConversations(user.id);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Получить сообщения диалога (с пагинацией по cursor)' })
  @ApiParam({ name: 'conversationId', description: 'ID диалога' })
  @ApiResponse({ status: 200, description: 'Список сообщений' })
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatService.getMessages(conversationId, user.id, dto);
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Отправить сообщение в диалог' })
  @ApiParam({ name: 'conversationId', description: 'ID диалога' })
  @ApiResponse({ status: 201, description: 'Сообщение отправлено' })
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(conversationId, user.id, dto);
  }

  @Post('conversations/with/:userId')
  @ApiOperation({ summary: 'Найти или создать диалог с пользователем' })
  @ApiParam({ name: 'userId', description: 'ID собеседника' })
  @ApiResponse({ status: 201, description: 'Диалог найден или создан' })
  findOrCreateConversation(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.chatService.findOrCreateConversation(user.id, userId);
  }

  @Patch('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Отметить сообщения диалога как прочитанные' })
  @ApiParam({ name: 'conversationId', description: 'ID диалога' })
  @ApiResponse({ status: 200, description: 'Сообщения отмечены прочитанными' })
  markAsRead(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.markAsRead(conversationId, user.id);
  }
}
