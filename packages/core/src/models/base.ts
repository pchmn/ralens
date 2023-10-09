export interface Model {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BaseModel<T extends boolean = true> = T extends true ? Model : Omit<Model, 'id'>;
