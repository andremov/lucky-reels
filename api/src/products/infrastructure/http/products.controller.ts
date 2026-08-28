import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ProductError, ProductView } from '../../domain/product';
import { GetProduct } from '../../application/get-product';
import { ListProducts } from '../../application/list-products';
import { ProductResponse } from './product.response';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProducts,
    private readonly getProduct: GetProduct,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List spin packs',
    description: 'Every pack on sale with the units a buyer can take right now.',
  })
  @ApiOkResponse({ type: [ProductResponse] })
  async list(): Promise<ProductView[]> {
    const result = await this.listProducts.execute();

    return result.match({ ok: (products) => products, err: toHttpError });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one spin pack',
    description: 'Fails with PRODUCT_NOT_FOUND when the id is unknown.',
  })
  @ApiOkResponse({ type: ProductResponse })
  async byId(@Param('id') id: string): Promise<ProductView> {
    const result = await this.getProduct.execute(id);

    return result.match({ ok: (product) => product, err: toHttpError });
  }
}

function toHttpError(error: ProductError): never {
  if (error.code === 'PRODUCT_NOT_FOUND') {
    throw new NotFoundException({ error: { code: error.code, message: error.message } });
  }

  throw new Error(error.message);
}
