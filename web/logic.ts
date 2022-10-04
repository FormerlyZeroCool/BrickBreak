import {SingleTouchListener, TouchMoveEvent, MouseDownTracker, isTouchSupported, KeyboardHandler} from './io.js'
import {RegularPolygon, getHeight, getWidth, RGB} from './gui.js'
import {random, srand, max_32_bit_signed, FixedSizeQueue} from './utils.js'
import {non_elastic_no_angular_momentum_bounce_vector, get_normal_vector_aabb_rect_circle_collision, magnitude, dot_product_2d, scalar_product_2d, normalize2D, distance, GameObject, menu_font_size, SpatiallyMappableCircle, SpatialHashMap2D, SquareAABBCollidable, Circle } from './game_utils.js'
class PowerUp {
    type_id:number;
    init_count_down:number;
    init_cool_down:number;
    power_up_count_down:number;
    power_up_cool_down:number;
    constructor(type_id:number, init_count_down:number, init_cool_down:number)
    {
        this.type_id = type_id;
        this.init_cool_down = init_cool_down;
        this.init_count_down = init_count_down;
        this.power_up_cool_down = 0;
        this.power_up_count_down = 0;
    }
    use(game:Game):void {}
    update_state(delta_time:number, game:Game):void {}
    desc():string { return "None"; }
};
function use_super(power_up:PowerUp, game:Game):void
{
    if(power_up.power_up_cool_down <= 0 && power_up.power_up_count_down >= 0)
    {
        power_up.use(game);
    }
}
function update_state_super(power_up:PowerUp, dt:number, game:Game):void
{
    power_up.power_up_count_down -= dt;
    power_up.power_up_cool_down -= dt;
    if(power_up.power_up_count_down > 0)
        power_up.update_state(dt / 10, game);
}
const default_count_down = 10 * 1000;
class PowerUpExtraPoints extends PowerUp {
    constructor()
    {
        super(1, default_count_down, 0);
    }
    use(game:Game):void {}
    update_state(delta_time:number, game:Game):void { game.score += delta_time * 2; }
    desc(): string {
        return "Extra Points";
    }
}
class PowerUpRandomBall extends PowerUp {

    constructor()
    {
        super(2, default_count_down, 750);
    }
    use(game:Game):void 
    {
        this.power_up_cool_down = this.init_cool_down;
        game.add_ball().release();
    }
    update_state(delta_time:number, game:Game):void { game.score += delta_time; }
    desc(): string {
        return `Press Space, or Double Tap to shoot random balls every ${Math.floor(this.init_cool_down / 10) / 100} seconds`;
    }
}
class PowerUpDoubleWide extends PowerUp {

    constructor()
    {
        super(3, default_count_down, 0);
    }
    use(game:Game):void {  }
    update_state(delta_time:number, game:Game):void 
    { 
        game.score += delta_time; 
        game.paddle.width = game.paddle.unscaled_width * 2; 
    }
    desc(): string {
        return `Double wide paddle`;
    }
}
class PowerUpDoubleAndAHalfWide extends PowerUp {

    constructor()
    {
        super(4, default_count_down, 250);
    }
    use(game:Game):void 
    { 
        const added = game.add_ball();
        this.power_up_cool_down = 250;
        added.release();
        added.radius = 5;
        added.width = 10;
        added.height = 10;
        added.direction[0] = 0;
        added.direction[1] = -1 * getHeight() / 3;
     }
    update_state(delta_time:number, game:Game):void 
    { 
        game.score += delta_time; 
        game.paddle.width = game.paddle.unscaled_width * 2.5; 
    }
    desc(): string {
        return `Press Space, or Double Tap to shoot tiny balls directly upwards every ${Math.floor(this.init_cool_down / 10) / 100} seconds`;
    }
}
class PowerUpSuperBall extends PowerUp {

    constructor()
    {
        super(5, default_count_down, default_count_down);
    }
    use(game:Game):void 
    { 
        const added = game.add_ball();
        this.power_up_cool_down = this.power_up_count_down;
        added.release();
        added.radius = Math.floor(game.width * 0.1);
        added.width =  Math.floor(game.width * 0.2);
        added.y -= added.width;
        added.height = Math.floor(game.width * 0.2);
        added.direction[0] = 0;
        added.direction[1] = -1 * getHeight() / 3;
    }
    update_state(delta_time:number, game:Game):void 
    { 
        game.score += delta_time; 
        game.paddle.width = game.paddle.unscaled_width * 1; 
    }
    desc(): string {
        return `Press Space, or Double Tap to shoot super ball every ${Math.floor(this.init_cool_down / 10) / 100} seconds`;
    }
}
const power_ups:PowerUp[] = []
power_ups.push(new PowerUp(0, 0, 0), new PowerUpExtraPoints(), new PowerUpRandomBall(), new PowerUpDoubleWide(), 
        new PowerUpDoubleAndAHalfWide(), new PowerUpSuperBall());

class Brick extends SquareAABBCollidable {
    hp:number;
    type_id:number;
    polygon:RegularPolygon;
    constructor(x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.type_id = Math.floor(random() * (power_ups.length - 1)) + 1;
        this.hp = Math.floor(this.type_id);
        const radius = Math.min(this.width, this.height) / 2;
        this.polygon = new RegularPolygon(radius, this.type_id + 2);
    }
    resize(width:number, height:number):void
    {
        this.width = width; 
        this.height = height;
        this.polygon.resize_radius(Math.min(width, height) / 2);
    }
    take_damage(damage:number):void
    {
        this.hp -= damage;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number = this.x, y: number = this.y, width: number = this.width, height: number = this.height): void {
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60*this.type_id % 256, 92*this.type_id % 256, 125*this.type_id % 256).htmlRBG();  
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
        ctx.beginPath();
        if(this.hp > 0)
        {
            this.polygon.sides = this.hp + 2;
            this.polygon.resize_radius(Math.min(width, height) / 2);
        }
        else 
        {
            this.polygon.sides = this.type_id + 2;
            this.polygon.resize_radius(Math.min(width, height) / 2);
        }
        this.polygon.render(ctx, x + this.width / 2 - this.polygon.width() / 2, y + this.height / 2 - this.polygon.height() / 2);
        ctx.fillStyle = new RGB(125 + 60*this.type_id % 256, 125 + 92*this.type_id % 256, 125 + 125*this.type_id % 256).htmlRBG();  
        ctx.fill();
        /*if(this.hp > 0)
        {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#000000";
            const text_width = ctx.measureText(""+this.hp).width;
            ctx.font = `${Math.min(canvas.height, canvas.width) > 700 ? 14 : 9}px Comic Sans`
            ctx.strokeText(""+this.hp, this.mid_x() - text_width / 2, this.mid_y());
            ctx.fillText(""+this.hp, this.mid_x() - text_width / 2, this.mid_y());
        }*/
    }
    update_state(delta_time: number): void {
        if(this.hp <= 0)
        {
            srand(this.type_id);
            this.y += (random() * 200 + 200) * delta_time / 1000;
        }
    }

};
class Paddle extends Brick {

    vel_x:number;
    target_vel_x:number;
    accel_x:number;
    target_x:number;
    power_up_type:PowerUp;
    unscaled_width:number;
    game:Game

    constructor(game:Game, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.game = game;
        this.unscaled_width = width * 2;
        this.accel_x = 0;
        this.target_vel_x = calc_x_vel_paddle();
        this.vel_x = 0;
        this.power_up_type = power_ups[0];
    }
    update_state_paddle(delta_time:number, game:Game):void
    {
        this.update_state(delta_time);
        if(this.x > game.width)
        {
            this.x = -this.width;
        }
        if(this.x + this.width < 0)
        {
            this.x = game.width;
        }
    }
    update_state(delta_time:number): void {
        
        this.vel_x += Math.abs(this.vel_x) < this.target_vel_x ? 
        this.accel_x * delta_time / 1000 : 
        0;
        update_state_super(this.power_up_type, delta_time, this.game);
        if((!keyboardHandler.keysHeld["ArrowLeft"] && !keyboardHandler.keysHeld["ArrowRight"]))
        if(Math.abs(this.mid_x() - this.target_x) < this.width / 10)
        {
            this.vel_x /= 2;
            this.accel_x /= 2;
        }
        //if((keyboardHandler.keysHeld["ArrowLeft"] || keyboardHandler.keysHeld["ArrowRight"]))
        {
            this.x += this.vel_x * delta_time / 1000;
        }
        
    }
    set_power_up(brick:Brick):void
    {
        const new_power_up =  power_ups[brick.type_id]!;
        if(this.power_up_type.type_id == 0 || new_power_up.type_id > 1 && this.power_up_type.power_up_count_down <= 0)
        {
            this.power_up_type = new_power_up;
            this.power_up_type.power_up_count_down = this.power_up_type.init_count_down;
        }
        else if(new_power_up.type_id === 1)
        {
            this.power_up_type.power_up_count_down = this.power_up_type.init_count_down;
        }
    }
    use_power_up(game:Game):void
    {
        if(this.power_up_type.power_up_count_down > 0 && this.power_up_type.power_up_cool_down <= 0)
        {
            use_super(this.power_up_type, game);
        }
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number = this.x, y: number = this.y, width: number = this.width, height: number = this.height): void {
        
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60*this.type_id % 256, 92*this.type_id % 256, 125*this.type_id % 256).htmlRBG();  
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
    }
}
class Ball extends SpatiallyMappableCircle {
    radius:number;
    direction:number[];
    attack_power:number;
    constructor(x:number, y:number, radius:number)
    {
        super(x - radius, y - radius, radius * 2, radius * 2);
        this.radius = radius;
        this.direction = [0, 0];
        this.attack_power = 1;
    }
    released():boolean
    {
        return this.direction[0] !== 0 || this.direction[1] !== 0;
    }
    release():void
    {
        if(!this.released())
        {
            srand(Math.random());
            this.direction = [(random() - 0.5) * getWidth() / 3, -random() * getHeight() / 2  - 100];
        }
    }
    mid_x(): number {
        return this.x + this.width / 2;
    }
    mid_y(): number {
        return this.y + this.height / 2;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x:number = this.x, y:number = this.y, width: number = this.width, height: number = this.height): void {
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#00FF00";
        ctx.fillStyle = "#FF0000";
        ctx.moveTo(x + this.radius * 2, y + this.radius);
        ctx.arc(x + this.radius, y + this.radius, this.radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.beginPath();
    }
    update_state(delta_time: number): void {
        super.update_state(delta_time);
    }
    bounce(x:number, y:number, width:number, height:number):boolean
    {
        if(this.x + this.width >= x + width)
        {
            if(this.direction[0] > 0)
                this.direction[0] *= -1;
            return false;
        }
        else if(this.x <= 0)
        {
            if(this.direction[0] < 0)
                this.direction[0] *= -1;
            return false;
        }
        else if(this.y + this.height >= y + height)
        {
            //if(this.direction[1] > 0)
              //  this.direction[1] *= -1;
            return true;
        }
        else if(this.y <= 0)
        {
            if(this.direction[1] < 0)
                this.direction[1] *= -1;
            return false;
        }
        return false;
    }
    hit(brick:Brick):void
    {
        brick.take_damage(this.attack_power);
        this.direction[1] *= 1.0;
    }
};
function calc_x_vel_paddle():number
{
    return Math.max(getWidth(), getHeight()) / (isTouchSupported() ? 1 : 2);
}
const keyboardHandler:KeyboardHandler = new KeyboardHandler();

class Game extends SquareAABBCollidable {
    collision_map:SpatialHashMap2D;
    bricks:Brick[];
    balls:Ball[];
    paddle:Paddle;
    last_dx:number;
    old_paddle_style:boolean;
    starting_lives:number;
    lives:number;
    score:number;
    constructor(touchListener:SingleTouchListener, starting_lives:number, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.score = 0;
        this.starting_lives = starting_lives;
        this.lives = starting_lives;
        this.last_dx = 0;
        this.old_paddle_style = false;
        //this.bricks.push(this.paddle);
        this.restart_game();
        touchListener.registerCallBack("touchmove", () => true, (event:TouchMoveEvent) => {
            this.last_dx = event.deltaX;
            this.paddle.target_x = event.touchPos[0];
            //this.paddle_vel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_vel_paddle() * 2;
            this.paddle.accel_x = (event.touchPos[0] - this.paddle.mid_x() > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
        });
        touchListener.registerCallBack("touchstart", () => true, (event:TouchMoveEvent) => {
            if(Date.now() - touchListener.lastTouchTime < 50)
            {
                this.paddle.use_power_up(this);
            }
            this.balls.forEach(ball => ball.release());
            this.paddle.accel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
            if(this.lives <= 0)
            {
                this.restart_game();
            }
        });
        touchListener.registerCallBack("touchend", () => true, (event:TouchMoveEvent) => {
            this.paddle.vel_x = 0;
            this.paddle.accel_x = 0;
        });
    }
    new_paddle():void
    {
        this.paddle = new Paddle(this, this.width / 2 - this.width * 0.05, this.height * 0.95, this.width * 0.1, this.height * 0.05);
        this.paddle.type_id = -1;
    }
    restart_game():void
    {
        this.new_paddle();
        this.bricks = [];
        this.balls = [];
        this.add_ball();
        this.score = 0;
        this.lives = this.starting_lives;
        this.init(this.width, this.height);
    }
    add_ball():Ball
    {
        this.balls.push(new Ball(this.paddle.mid_x(), this.paddle.y - this.height * 0.05, this.height * 0.025));
        return this.balls[this.balls.length - 1];
    }
    init(width:number, height:number):void
    {
        srand(Math.random() * max_32_bit_signed);
        const bricks_across = 20;
        const brick_width = (width / bricks_across);
        const brick_height = (height * 0.05);
        for(let y = brick_height; y < 5*brick_height; y += brick_height)
        {
            for(let x = brick_width; x < 17 * brick_width; x += brick_width)
            {
                this.bricks.push(new Brick(x, y + brick_height, brick_width, brick_height));
            }
        }
    }
    resize(width:number, height:number):void
    {
        const bricks_across = 20;
        const brick_width = (width / bricks_across);
        const brick_height = (height * 0.05);
        for(let i = 0; i < this.bricks.length; i++)
        {
            const brick = this.bricks[i];
            const px = brick.x / this.width;
            const py = brick.y / this.height;
            brick.x = px * width;
            brick.y = py * height;
            brick.resize(brick_width, brick_height);
        }

        const px = this.paddle.x / this.width;
        const py = this.paddle.y / this.height;
        this.paddle.x = px * width;
        this.paddle.y = py * height;
        this.paddle.width = brick_width *  (height > width ? 4 : 3);
        this.paddle.unscaled_width = this.paddle.width;
        this.balls.forEach(ball => {
            const px = ball.x / this.width;
            const py = ball.y / this.height;
            ball.x = px * width;
            ball.y = py * height;
            if(Math.abs(ball.radius - this.height * 0.025) < 0.1)
            {
                ball.radius = height * 0.025;
                ball.width = ball.radius * 2;
                ball.height = ball.radius * 2;
            }
        });
        this.width = width;
        this.height = height;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
        
        for(let i = 0; i < this.bricks.length; i++)
        {
            const brick = this.bricks[i];
            brick.draw(canvas, ctx, brick.x, brick.y, brick.width, brick.height);
        }
        for(let i = 0; i < this.balls.length; i++)
        {
            const ball = this.balls[i];
            ball.draw(canvas, ctx);
        }
        this.paddle.draw(canvas, ctx);
        ctx.beginPath();
        const font_size = menu_font_size();
        ctx.font = `${font_size}px Helvetica`;
        ctx.fillStyle = "#000000";
        ctx.strokeStyle = "#FFFFFF";
        let text = `Score: ${Math.floor(this.score)}`;
        let i = 1;
        ctx.strokeText(text, 0, font_size * i);
        ctx.fillText(text, 0, font_size * i);
        i++;
        ctx.strokeText("Lives: " + Math.floor(this.lives), 0, font_size * i);
        ctx.fillText("Lives: " + Math.floor(this.lives), 0, font_size * i);

        i = 0.5;
        text = `Powerup: ${this.paddle.power_up_type.desc()}. Lasts for: ${this.paddle.power_up_type.power_up_count_down <= 0 ? 0 : Math.floor(this.paddle.power_up_type.power_up_count_down / 100)/10} seconds.`;
        ctx.strokeText(text, 0, this.height - font_size * i);
        ctx.fillText(text, 0, this.height - font_size * i);
        if(this.lives <= 0)
        {
            let i = 0;
            let text = `Game Over, no lives remaining.`;
            let text_width = ctx.measureText(text).width;
            ctx.strokeText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            ctx.fillText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            i++;
            text = `Final score: ${Math.floor(this.score)}`;
            text_width = ctx.measureText(text).width;
            ctx.strokeText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            ctx.fillText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            i++;
            text = `Click, Tap, or press Space to restart.`;
            text_width = ctx.measureText(text).width;
            ctx.strokeText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            ctx.fillText(text, width / 2 - text_width / 2, height / 2 + i * font_size);
            i++;

        }
    }
    update_state(delta_time: number): void {
        if(this.lives <= 0)
        {
            return;
        }
        if(this.bricks.length === 0)
        {
            this.init(this.width, this.height);
        }
        this.paddle.width = this.paddle.unscaled_width;
        this.paddle.update_state_paddle(delta_time, this);
        for(let i = 0; i < this.balls.length; i++)
        {
            const ball = this.balls[i];
            ball.update_state(delta_time);
            const destroy_ball:boolean = ball.bounce(this.x, this.y, this.width, this.height) || ball.mid_x() + ball.radius < 0 || ball.mid_x()  - ball.radius > this.width ||
            ball.mid_y() + ball.radius < 0 || ball.mid_y() - ball.radius > this.height;
            if(!ball.released())
            {
                ball.x = this.paddle.mid_x() - ball.radius;
                ball.y = this.paddle.y - this.height * 0.05 - 5;
            }
            if(destroy_ball)
            {
                const ball_index = this.balls.indexOf(ball);
                if(ball_index !== -1)
                    this.balls.splice(ball_index, 1);
            }
        }
        this.collision_map = new SpatialHashMap2D([this.paddle], this.bricks, this.balls, this.width, this.height, 20, 20);
        this.collision_map.handle_by_cell( 
        (paddle:SquareAABBCollidable, paddle2:SquareAABBCollidable) => {
        }, (paddle:Paddle, brick:Brick) => {
            if(paddle === this.paddle && brick.hp !== undefined && brick.hp <= 0)
            {
                const falling:Brick = brick;
                if(falling.hp <= 0)
                {
                    const tdb_index = this.bricks.indexOf(falling);
                    (paddle).set_power_up(brick);
                    if(tdb_index >= 0)
                        this.bricks.splice(tdb_index, 1);
                }
            }
            
        }, (paddle:SquareAABBCollidable, ball:SquareAABBCollidable) => {
            if(paddle === this.paddle && ball.radius !== undefined)
            {
                const b:Ball =<Ball> ball;
                if(b.direction[1] > 0)
                {
                    //b.direction[1] *= -1;
                    if(this.old_paddle_style)
                    {
                        const angle = Math.round(((b.mid_x() - paddle.x) / paddle.width) * Math.PI * 20) / 20;
                        const mag = Math.sqrt(b.direction[0] * b.direction[0] + b.direction[1] * b.direction[1]);
                        b.direction[0] = Math.cos(angle) * mag * -1;
                        b.direction[1] = Math.sin(angle) * mag * -1;
                    }
                    else
                    {
                        b.y = paddle.y - b.height;
                        b.direction[1] *= -1;
                        b.direction[0] += this.paddle.vel_x;
                        if(Math.abs(b.direction[0]) > this.paddle.target_vel_x)
                        {
                            b.direction[0] = this.paddle.target_vel_x * +(b.direction[0] >= 0) - this.paddle.target_vel_x * +(b.direction[0] < 0);
                        }
                    }
                    if(b.direction[1] > -this.height / 4)
                        b.direction[1] = -this.height / 3;
                }
            } 
        },
        (brick:Brick, ball:Ball) => {
            const collision_code = brick.collides_with_circle(<Ball> ball);
            if((<Ball> ball).radius && collision_code)
            {
                const b = <Ball> ball;
                
                if(ball.radius && (brick).hp > 0 && brick !== this.paddle)
                {

                    const collision_code = brick.collides_with_circle(ball);

                    //collision code 0 no collision
                    //1 corner collision
                    //2 edge collision
                    ball.direction[0] *= -1;
                    ball.direction[1] *= -1;
                    ball.update_state(delta_time);
                    ball.direction[0] *= -1;
                    ball.direction[1] *= -1;

                    //if dist between ball center, and rect center 
                    //is greater than Max(brick.width/2, brick.height/2) + ball.radius
                    //take diff between dist above, and Max(brick.width/2, brick.height/2) + ball.radius
                    //move ball by multiplying that diff by the components of dir, and translating ball by result
                    const dist = distance(ball, brick);
                    const max_dist = Math.max(brick.width / 2, brick.height / 2) + ball.radius;
                    if(dist > max_dist)
                    {
                        const delta_mag:number = ball.mid_y() > brick.mid_y()?-max_dist + dist:max_dist - dist;
                        const norm_dir = normalize2D(ball.direction);
                        ball.x += norm_dir[0] * delta_mag;
                        ball.y += norm_dir[1] * delta_mag;
                    }
                    else if(dist < max_dist && collision_code === 1)
                    {
                        const delta_mag:number = ball.mid_y() > brick.mid_y()?-max_dist + dist:max_dist - dist;
                        const norm_dir = normalize2D(ball.direction);
                        ball.x += norm_dir[0] * delta_mag;
                        ball.y += norm_dir[1] * delta_mag;
                    }

                    const normal:number[] = get_normal_vector_aabb_rect_circle_collision(ball, brick);
                    if(normal[0] !== 0 || normal[1] !== 0)
                    {
                        ball.hit(brick);
                        ball.direction = non_elastic_no_angular_momentum_bounce_vector(ball.direction, normal);
                        ball.update_state(delta_time);
                    }
                    
                }

            }
        });
        if(this.balls.length === 0)
        {
            //this.bricks = [];
            this.lives -= 1;
            this.add_ball();
            //this.init(this.height, this.width);
        }
        //relies on coercing undefined to be false, and false to 0
        if(!isTouchSupported())
            this.paddle.accel_x = calc_x_accel_paddle() * +(keyboardHandler.keysHeld["ArrowRight"] >= 1) - calc_x_accel_paddle() * +(keyboardHandler.keysHeld["ArrowLeft"] >= 1);

        for(let i = 0; i < this.bricks.length; i++)
        {
            const bri = this.bricks[i];
            bri.update_state(delta_time);
            if(bri.y > this.height)
                this.bricks.splice(i, 1);
        }
    }
};
function calc_x_accel_paddle():number
{
    return calc_x_vel_paddle() * 2;
}
async function main()
{
    const canvas:HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("screen");
    const touchListener = new SingleTouchListener(canvas, true, true, false);


    canvas.onmousemove = (event:MouseEvent) => {
    };
    canvas.addEventListener("wheel", (e) => {
        //e.preventDefault();
    });
    canvas.width = getWidth();
    canvas.height = getHeight();
    canvas.style.cursor = "pointer";
    let counter = 0;
    const touchScreen:boolean = isTouchSupported();
    let height = getHeight();
    let width = getWidth();
    let game = new Game(touchListener, 3, 0, 0, height, width);
    window.game = game;
    let low_fps:boolean = false;
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event:any) => {

        switch(event.code)
                {
                    case("Space"):
                        game.balls.forEach(ball => ball.release());
                        game.paddle.use_power_up(game);            
                        if(game.lives <= 0)
                        {
                            game.restart_game();
                        }
                    break;
                   
                    case("KeyL"):
                    low_fps = !low_fps;
                    break;
                    case("ArrowUp"):
                    break;
                    case("ArrowDown"):
                        game.add_ball();
                    break;
                }
    });
    keyboardHandler.registerCallBack("keyup", () => true, (event:any) => {
        switch(event.code)
                {
                    case("ArrowLeft"):
                    if(game.paddle.vel_x < 0)
                    {
                        game.paddle.vel_x = 0;
                        game.paddle.accel_x = 0;
                    }
                    break;
                    case("ArrowRight"):
                    if(game.paddle.vel_x > 0)
                    {
                        game.paddle.vel_x = 0;
                        game.paddle.accel_x = 0;
                    }
                    break;
                }
    });
    let maybectx:CanvasRenderingContext2D | null = canvas.getContext("2d");
    if(!maybectx)
        return;
    const ctx:CanvasRenderingContext2D = maybectx;
    let start = Date.now();
    let dt = 1;
    const ostart = Date.now();
    let frame_count = 0;
    let instantaneous_fps = 0;
    const time_queue:FixedSizeQueue<number> = new FixedSizeQueue<number>(60 * 2);
    const drawLoop = () => 
    {
        frame_count++;
        //do stuff and render here
        if(getWidth() !== width)
        {
            width = getWidth();
            height = getHeight() - 50;
            game.resize(width, height);
            canvas.width = width;
            canvas.height = height;
            //game.paddle.update_state_paddle(0, game);
        }
        dt = Date.now() - start;
        time_queue.push(dt);
        start = Date.now();
        let sum = 0;
        let highest = 0;
        for(let i = 0; i < time_queue.length; i++)
        {
            const value = time_queue.get(i);
            sum += value;
            if(highest < value)
            {
                highest = value;
            }
        }
        game.update_state(dt);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        game.draw(canvas, ctx, game.x, game.y, game.width, game.height);
        if(frame_count % 10 === 0)
            instantaneous_fps = Math.floor(1000 / (low_fps?highest:dt));
        let text = "";
        text = `avg fps: ${Math.floor(1000 * time_queue.length / sum)}, ${low_fps?"low":"ins"} fps: ${instantaneous_fps}`;
        const text_width = ctx.measureText(text).width;
        ctx.strokeText(text, game.width - text_width - 10, menu_font_size());
        ctx.fillText(text, game.width - text_width - 10, menu_font_size());

        requestAnimationFrame(drawLoop);
    }
    drawLoop();
    game.resize(width, height - 50);

}
main();





