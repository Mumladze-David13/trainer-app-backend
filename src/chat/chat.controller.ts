import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  getConversations(@CurrentUser() user: { id: string }) {
    return this.chatService.getConversations(user.id);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatService.getMessages(conversationId, user.id, dto);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(conversationId, user.id, dto);
  }

  @Post('conversations/with/:userId')
  findOrCreateConversation(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.chatService.findOrCreateConversation(user.id, userId);
  }

  @Patch('conversations/:conversationId/read')
  markAsRead(
    @CurrentUser() user: { id: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.markAsRead(conversationId, user.id);
  }
}
