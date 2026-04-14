import { Request, Response, NextFunction } from "express";
import * as productService from "../services/product.service";
import createResponse from "../utils/response";
import { GetProductsQuery } from "../schemas/product.schema";

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = req.query as unknown as GetProductsQuery;
    const result = await productService.getProducts(query);

    return res.status(200).json(
      createResponse({
        success: true,
        status: 200,
        message: "Products retrieved",
        data: {
          products: result.products,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          },
        },
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params as { id: string };
    const product = await productService.getProductById(id);

    return res.status(200).json(
      createResponse({
        success: true,
        status: 200,
        message: "Product retrieved",
        data: product,
      }),
    );
  } catch (error) {
    next(error);
  }
};
