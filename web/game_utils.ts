
import { GuiElement } from './gui.js'
import {isTouchSupported} from './io.js'

export function menu_font_size():number { return isTouchSupported() ? 27:22; }
export function distance(a:SquareAABBCollidable, b:SquareAABBCollidable):number
{
    const dx = a.mid_x() - b.mid_x();
    const dy = a.mid_y() - b.mid_y();
    return Math.sqrt(dx*dx + dy*dy);
}
export function manhattan_distance(a:SquareAABBCollidable, b:SquareAABBCollidable):number
{
    const dx = Math.abs(a.mid_x() - b.mid_x());
    const dy = Math.abs(a.mid_y() - b.mid_y());
    return dx + dy;
}
export interface GameObject {
    draw(canvas:HTMLCanvasElement, ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number):void;
    update_state(delta_time:number):void;
};
export interface Attackable {
    dim():number[];
    attack(enemy:Attackable):void;
    offense():number;
    defense():number; //0 - 1 //1 is 100% // 0 is 0%
    lose_hp(hp:number, enemy:Attackable):void;
};
export interface SpatialObject {
    get_normalized_direction_vector(other:SpatialObject):number[];
    dim():number[];
    mid_x():number;
    mid_y():number;
};
export interface Collidable extends SpatialObject {
    x:number;
    y:number;
    check_collision(other:SquareAABBCollidable):boolean;
    max_width():number;
    max_height():number;
    get_normalized_direction_vector(other:SpatialObject):number[];
    dim():number[];
    mid_x():number;
    mid_y():number;
};
export interface Circle {
    radius:number;
    mid_x():number;
    mid_y():number;
};
export class SquareAABBCollidable implements Collidable, GameObject {
    x:number;
    y:number;
    width:number;
    height:number;

    constructor(x:number, y:number, width:number, height:number)
    {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    collides_with_circle(circle:Circle)
    {
        const dx = Math.abs(circle.mid_x() - this.mid_x());
        const dy = Math.abs(circle.mid_y() - this.mid_y());

        if (dx > (this.width/2 + circle.radius) || dy > (this.height/2 + circle.radius)) { return false; }

        if (dx <= (this.width/2) || dy <= (this.height/2)) { return true; }

        const cornerDistance_sq = (dx - this.width/2) * (dx - this.width/2) +
            (dy - this.height/2) * (dy - this.height/2);

        return (cornerDistance_sq <= (circle.radius * circle.radius));
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        throw new Error('Method not implemented.');
    }
    update_state(delta_time: number): void {
        throw new Error('Method not implemented.');
    }
    max_width():number { return this.width; }
    max_height():number {return this.height; }
    check_collision(other:SquareAABBCollidable):boolean
    {
        return this.x < other.x + other.width && other.x < this.x + this.width && 
            this.y < other.y + other.height && other.y < this.y + this.height;
    }
    check_collision_gui(other:GuiElement, x:number, y:number):boolean
    {
        return this.x < x + other.width() && x < this.x + this.width && 
            this.y < y + other.height() && y < this.y + this.height;
    }
    get_normalized_direction_vector(other:SpatialObject):number[]
    {
        const dy:number = -this.mid_y() + other.mid_y();
        const dx:number = -this.mid_x() + other.mid_x();
        const dist = Math.sqrt(dy*dy + dx*dx);
        const norm_dy = dy / dist;
        const norm_dx = dx / dist;
        return [dx / dist, dy / dist];
    }
    dim():number[]
    {
        return [this.x, this.y, this.width, this.height];
    }
    mid_x():number
    {
        return this.x + this.width / 2;
    }
    mid_y():number
    {
        return this.y + this.height / 2;
    }
};
export class Cell {
    collidable_objects:SquareAABBCollidable[];
    collidable_not_with_self:SquareAABBCollidable[];
    constructor()
    {
        this.collidable_objects = [];
        this.collidable_not_with_self = []
    }
    push_collidable(object:SquareAABBCollidable):void
    {
        this.collidable_objects.push(object);
    }
    push_collidable_not_with_self(object:SquareAABBCollidable):void
    {//will only collide with regular collidable objects not with themselves
        this.collidable_not_with_self.push(object);
    }
};
export class SpatialHashMap2D {
    data:Cell[];
    screen_width:number;
    screen_height:number;
    cells_vertical:number;
    cells_horizontal:number;
    constructor(collidables:SquareAABBCollidable[], collidable_not_with_self:SquareAABBCollidable[], 
        screen_width:number, screen_height:number, cells_vertical:number, cells_horizontal:number)
    {
        this.data = [];
        screen_width = screen_width;
        screen_height = screen_height;
        cells_horizontal = cells_horizontal;
        cells_vertical = cells_vertical;
        for(let i = 0; i < cells_vertical * cells_horizontal; i++)
        {
            this.data.push(new Cell());
        }
        for(let i = 0; i < collidable_not_with_self.length; i++)
        {
            const collidable = collidable_not_with_self[i];
            const dx = Math.ceil(collidable.max_width() / screen_width * cells_horizontal);
            const dy = Math.ceil(collidable.max_height() / screen_height * cells_vertical);
            {
                const grid_x = Math.floor((collidable.x) / screen_width * cells_horizontal);
                const grid_y = Math.floor((collidable.y) / screen_height * cells_vertical);

                for(let y = 0; y < dy; y++)
                {
                    for(let x = 0; x < dx && x + grid_x < cells_horizontal; x++)
                    {
                        const cell = this.data[grid_x + x + (grid_y + y) * cells_horizontal];
                        if(cell)
                            cell.push_collidable_not_with_self(collidable);
                    }
                }
            }
        }
        for(let i = 0; i < collidables.length; i++)
        {
            const collidable = collidables[i];
            const dx = Math.ceil(collidable.max_width() / screen_width * cells_horizontal);
            const dy = Math.ceil(collidable.max_height() / screen_height * cells_vertical);
            {
                const grid_x = Math.floor((collidable.x) / screen_width * cells_horizontal);
                const grid_y = Math.floor((collidable.y) / screen_height * cells_vertical);

                for(let y = 0; y < dy; y++)
                {
                    for(let x = 0; x < dx; x++)
                    {
                        const cell = this.data[grid_x + x + (grid_y + y) * cells_horizontal];
                        if(cell)
                            cell.push_collidable(collidable);
                    }
                }
            }
        }
    }
    push_collidable(collidable:SquareAABBCollidable):void
    {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        this.data[grid_x + grid_y * this.cells_horizontal].push_collidable(collidable);
    }
    push_collidable_not_with_self(collidable:SquareAABBCollidable):void
    {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        this.data[grid_x + grid_y * this.cells_horizontal].push_collidable_not_with_self(collidable);
    }
    remove_collidable(collidable:SquareAABBCollidable):void
    {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        const cell = this.data[grid_x + grid_y * this.cells_horizontal].collidable_objects;
        cell.splice(cell.indexOf(collidable), 1);
    }
    remove_collidable_not_with_self(collidable:SquareAABBCollidable):void
    {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        const cell = this.data[grid_x + grid_y * this.cells_horizontal].collidable_not_with_self;
        cell.splice(cell.indexOf(collidable), 1);
    }
    handle_by_cell(callback:(a:SquareAABBCollidable, b:SquareAABBCollidable) => void,
        callback_rhs_collidable_not_with_self:(a:SquareAABBCollidable, b:SquareAABBCollidable) => void):void
    {
        for(let i = 0; i < this.data.length; i++)
        {
            this.handle_cell(i, callback, callback_rhs_collidable_not_with_self);
        }
    }
    handle_cell(index:number, callback:(a:SquareAABBCollidable, b:SquareAABBCollidable) => void, 
        callback_rhs_collidable_not_with_self:(a:SquareAABBCollidable, b:SquareAABBCollidable) => void):void
    {
        const cell = this.data[index];
        const collidables = cell.collidable_objects;
        const collidables_not_with_self = cell.collidable_not_with_self;
        for(let i = 0; i < collidables.length; i++)
        {
            const collidable = collidables[i];
            for(let j = 0; j < collidables_not_with_self.length; j++)
            {
                const collidable2 = collidables_not_with_self[j];
                if(collidable2.check_collision(collidable))
                {
                    callback_rhs_collidable_not_with_self(collidable, collidable2);
                }
            }
            for(let j = 0; j < collidables.length; j++)
            {
                const collidable2 = collidables[j];
                if(collidable2.check_collision(collidable))
                {
                   callback(collidable, collidable2);
                }
            }
        }
        
    }
    draw_objects(canvas:HTMLCanvasElement, ctx:CanvasRenderingContext2D):void
    {
        for(let i = 0; i < this.data.length; i++)
        {
            const cell = this.data[i];
            for(let j = 0; j < cell.collidable_not_with_self.length; j++)
            {
                const drawable = cell.collidable_not_with_self[i];
                drawable.draw(canvas, ctx, drawable.x, drawable.y, drawable.width, drawable.height);
            }
            for(let j = 0; j < cell.collidable_objects.length; j++)
            {
                const drawable = cell.collidable_objects[i];
                drawable.draw(canvas, ctx, drawable.x, drawable.y, drawable.width, drawable.height);
            }
        }
    }
};