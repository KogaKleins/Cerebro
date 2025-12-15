/**
 * 🧠 CÉREBRO - Coffee Controller
 * Handlers HTTP para rotas de café
 */

import { Response, NextFunction } from 'express';
import { CoffeeService } from '../services/coffee.service';
import { AuthRequest } from '../types';

export class CoffeeController {
  constructor(private coffeeService: CoffeeService) {}
  
  /**
   * POST /api/v2/coffees
   * Cria um novo registro de café
   */
  create = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffee = await this.coffeeService.create(
        req.user!.username,
        req.body
      );
      
      res.status(201).json({ 
        success: true, 
        data: coffee 
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * POST /api/v2/coffees/:coffeeId/rate
   * Avalia um café
   */
  rateCoffee = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rating = await this.coffeeService.rateCoffee(
        req.user!.username,
        req.params.coffeeId,
        req.body
      );
      
      res.json({ 
        success: true, 
        data: rating 
      });
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * GET /api/v2/coffees
   * Lista cafés recentes
   */
  getRecent = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffees = await this.coffeeService.getRecent(50);
      res.json(coffees);
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * GET /api/v2/coffees/:coffeeId
   * Busca um café específico
   */
  getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffee = await this.coffeeService.getById(req.params.coffeeId);
      res.json(coffee);
    } catch (error) {
      next(error);
    }
  };
  
  /**
   * GET /api/v2/coffees/stats
   * Estatísticas gerais de cafés
   */
  getStats = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await this.coffeeService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
