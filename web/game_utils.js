import { isTouchSupported } from './io.js';
export function menu_font_size() { return isTouchSupported() ? 27 : 22; }
export function distance(a, b) {
    const dx = a.mid_x() - b.mid_x();
    const dy = a.mid_y() - b.mid_y();
    return Math.sqrt(dx * dx + dy * dy);
}
export function non_elastic_no_angular_momentum_bounce_vector(direction_vector, normal_vector) {
    const mag = magnitude(direction_vector[0], direction_vector[1]);
    const collision_vector = normalize2D(normal_vector);
    const ndirection = normalize2D(direction_vector);
    const u = scalar_product_2d(dot_product_2d(ndirection, collision_vector), collision_vector);
    const w = [ndirection[0] - u[0], ndirection[1] - u[1]];
    return [(w[0] - u[0]) * mag, (w[1] - u[1]) * mag];
}
export function magnitude(a, b) {
    return Math.sqrt(a * a + b * b);
}
export function scalar_product_2d(a, b) {
    return [a * b[0], a * b[1]];
}
export function dot_product_2d(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}
export function normalize2D(vector) {
    const mag = magnitude(vector[0], vector[1]);
    return [vector[0] / mag, vector[1] / mag];
}
export function manhattan_distance(a, b) {
    const dx = Math.abs(a.mid_x() - b.mid_x());
    const dy = Math.abs(a.mid_y() - b.mid_y());
    return dx + dy;
}
;
;
;
;
;
export class SquareAABBCollidable {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    collides_with_circle(circle) {
        const dx = Math.abs(circle.mid_x() - this.mid_x());
        const dy = Math.abs(circle.mid_y() - this.mid_y());
        if (dx > (this.width / 2 + circle.radius)) {
            return 0;
        }
        if (dy > (this.height / 2 + circle.radius)) {
            return 0;
        }
        if (dx <= (this.width / 2) || dy <= (this.height / 2)) {
            return 2;
        }
        const cornerDistance_sq = (dx - this.width / 2) * (dx - this.width / 2) +
            (dy - this.height / 2) * (dy - this.height / 2);
        return +(cornerDistance_sq <= (circle.radius * circle.radius));
    }
    draw(canvas, ctx, x, y, width, height) {
        throw new Error('Method not implemented.');
    }
    update_state(delta_time) {
        throw new Error('Method not implemented.');
    }
    max_width() { return this.width; }
    max_height() { return this.height; }
    check_collision(other) {
        return this.x < other.x + other.width && other.x < this.x + this.width &&
            this.y < other.y + other.height && other.y < this.y + this.height;
    }
    check_collision_gui(other, x, y) {
        return this.x < x + other.width() && x < this.x + this.width &&
            this.y < y + other.height() && y < this.y + this.height;
    }
    get_normalized_direction_vector(other) {
        const dy = -this.mid_y() + other.mid_y();
        const dx = -this.mid_x() + other.mid_x();
        const dist = Math.sqrt(dy * dy + dx * dx);
        const norm_dy = dy / dist;
        const norm_dx = dx / dist;
        return [dx / dist, dy / dist];
    }
    dim() {
        return [this.x, this.y, this.width, this.height];
    }
    mid_x() {
        return this.x + this.width / 2;
    }
    mid_y() {
        return this.y + this.height / 2;
    }
}
;
export class Cell {
    constructor() {
        this.collidable_objects = [];
        this.collidable_not_with_self = [];
    }
    push_collidable(object) {
        this.collidable_objects.push(object);
    }
    push_collidable_not_with_self(object) {
        this.collidable_not_with_self.push(object);
    }
}
;
export class SpatialHashMap2D {
    constructor(collidables, collidable_not_with_self, screen_width, screen_height, cells_vertical, cells_horizontal) {
        this.data = [];
        screen_width = screen_width;
        screen_height = screen_height;
        cells_horizontal = cells_horizontal;
        cells_vertical = cells_vertical;
        for (let i = 0; i < cells_vertical * cells_horizontal; i++) {
            this.data.push(new Cell());
        }
        for (let i = 0; i < collidable_not_with_self.length; i++) {
            const collidable = collidable_not_with_self[i];
            const dx = Math.ceil(collidable.max_width() / screen_width * cells_horizontal);
            const dy = Math.ceil(collidable.max_height() / screen_height * cells_vertical);
            {
                const grid_x = Math.floor((collidable.x) / screen_width * cells_horizontal);
                const grid_y = Math.floor((collidable.y) / screen_height * cells_vertical);
                for (let y = 0; y <= dy; y++) {
                    for (let x = 0; x <= dx && x + grid_x < cells_horizontal; x++) {
                        const cell = this.data[grid_x + x + (grid_y + y) * cells_horizontal];
                        if (cell)
                            cell.push_collidable_not_with_self(collidable);
                    }
                }
            }
        }
        for (let i = 0; i < collidables.length; i++) {
            const collidable = collidables[i];
            const dx = Math.ceil(collidable.max_width() / screen_width * cells_horizontal);
            const dy = Math.ceil(collidable.max_height() / screen_height * cells_vertical);
            {
                const grid_x = Math.floor((collidable.x) / screen_width * cells_horizontal);
                const grid_y = Math.floor((collidable.y) / screen_height * cells_vertical);
                for (let y = 0; y <= dy; y++) {
                    for (let x = 0; x <= dx; x++) {
                        const cell = this.data[grid_x + x + (grid_y + y) * cells_horizontal];
                        if (cell)
                            cell.push_collidable(collidable);
                    }
                }
            }
        }
    }
    push_collidable(collidable) {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        this.data[grid_x + grid_y * this.cells_horizontal].push_collidable(collidable);
    }
    push_collidable_not_with_self(collidable) {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        this.data[grid_x + grid_y * this.cells_horizontal].push_collidable_not_with_self(collidable);
    }
    remove_collidable(collidable) {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        const cell = this.data[grid_x + grid_y * this.cells_horizontal].collidable_objects;
        cell.splice(cell.indexOf(collidable), 1);
    }
    remove_collidable_not_with_self(collidable) {
        const grid_x = Math.floor((collidable.x) / this.screen_width * this.cells_horizontal);
        const grid_y = Math.floor((collidable.y) / this.screen_height * this.cells_vertical);
        const cell = this.data[grid_x + grid_y * this.cells_horizontal].collidable_not_with_self;
        cell.splice(cell.indexOf(collidable), 1);
    }
    handle_by_cell(callback, callback_rhs_collidable_not_with_self) {
        for (let i = 0; i < this.data.length; i++) {
            this.handle_cell(i, callback, callback_rhs_collidable_not_with_self);
        }
    }
    handle_cell(index, callback, callback_rhs_collidable_not_with_self) {
        const cell = this.data[index];
        const collidables = cell.collidable_objects;
        const collidables_not_with_self = cell.collidable_not_with_self;
        for (let i = 0; i < collidables.length; i++) {
            const collidable = collidables[i];
            for (let j = 0; j < collidables_not_with_self.length; j++) {
                const collidable2 = collidables_not_with_self[j];
                if (collidable2.check_collision(collidable)) {
                    callback_rhs_collidable_not_with_self(collidable, collidable2);
                }
            }
            for (let j = 0; j < collidables.length; j++) {
                const collidable2 = collidables[j];
                if (collidable2.check_collision(collidable)) {
                    callback(collidable, collidable2);
                }
            }
        }
    }
    draw_objects(canvas, ctx) {
        for (let i = 0; i < this.data.length; i++) {
            const cell = this.data[i];
            for (let j = 0; j < cell.collidable_not_with_self.length; j++) {
                const drawable = cell.collidable_not_with_self[i];
                drawable.draw(canvas, ctx, drawable.x, drawable.y, drawable.width, drawable.height);
            }
            for (let j = 0; j < cell.collidable_objects.length; j++) {
                const drawable = cell.collidable_objects[i];
                drawable.draw(canvas, ctx, drawable.x, drawable.y, drawable.width, drawable.height);
            }
        }
    }
}
;
