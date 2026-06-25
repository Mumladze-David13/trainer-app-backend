import { PartialType } from '@nestjs/swagger';
import { AddMealDto } from './add-meal.dto';

export class UpdateMealDto extends PartialType(AddMealDto) {}
