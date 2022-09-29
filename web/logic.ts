import {SingleTouchListener, TouchMoveEvent, MouseDownTracker, isTouchSupported, KeyboardHandler} from './io.js'
import {render_funky_regular_polygon, render_regular_polygon, getHeight, getWidth, RGB} from './gui.js'
import {random, srand, max_32_bit_signed, get_angle, logToServer, logBinaryToServer, readFromServer, sleep} from './utils.js'
import {non_elastic_no_angular_momentum_bounce_vector, magnitude, dot_product_2d, scalar_product_2d, distance, GameObject, menu_font_size, SpatialHashMap2D, SquareAABBCollidable, Circle, normalize2D } from './game_utils.js'

class Ball extends SquareAABBCollidable implements Circle {
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
        this.x += this.direction[0] * delta_time / 1000;
        this.y += this.direction[1] * delta_time / 1000;
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
            if(this.direction[1] > 0)
                this.direction[1] *= -1;
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
        this.direction[1] *= 1.01;
    }
};
class Brick extends SquareAABBCollidable {
    hp:number;
    type_id:number;
    constructor(x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.type_id = Math.floor(random() * 5) + 1;
        this.hp = Math.floor(this.type_id);
    }
    take_damage(damage:number):void
    {
        this.hp -= damage;
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number = this.x, y: number = this.y, width: number = this.width, height: number = this.height): void {
        
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60*this.type_id % 256, 92*this.type_id % 256, 125*this.type_id % 256).htmlRBG();  
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
        if(this.hp > 0)
        {
            ctx.fillStyle = "#000000";
            ctx.fillText(""+this.hp, this.mid_x(), this.mid_y());
        }
    }
    update_state(delta_time: number): void {
        if(this.hp <= 0)
        {
            srand(this.type_id);
            this.y += (random() * 200 + 200) * delta_time / 1000;
        }
    }

};
function calc_x_vel_paddle():number
{
    return Math.max(getWidth(), getHeight()) / (isTouchSupported() ? 1 : 2);
}
const keyboardHandler:KeyboardHandler = new KeyboardHandler();
class Paddle extends Brick {

    vel_x:number;
    target_vel_x:number;
    accel_x:number;
    target_x:number;
    power_up_count_down:number;
    power_up_cool_down:number;
    power_up_type:Brick;
    unscaled_width:number;

    constructor(x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.unscaled_width = width * 2;
        this.power_up_cool_down = 0;
        this.accel_x = 0;
        this.target_vel_x = calc_x_vel_paddle();
        this.vel_x = 0;
        this.power_up_count_down = 0;
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
        if((!keyboardHandler.keysHeld["ArrowLeft"] && !keyboardHandler.keysHeld["ArrowRight"]))
        if(Math.abs(this.mid_x() - this.target_x) < this.width / 4)
        {
            this.vel_x /= 2;
            this.accel_x /= 2;
        }
        //if((keyboardHandler.keysHeld["ArrowLeft"] || keyboardHandler.keysHeld["ArrowRight"]))
        {
            this.x += this.vel_x * delta_time / 1000;
        }
        if(this.power_up_count_down > 0)
        {
            this.power_up_count_down -= delta_time;
            if(this.power_up_type.type_id === 3 && Math.abs(this.width - 2 * this.unscaled_width) > 0.1)
            {
                this.width = this.unscaled_width * 2;
            }
            else if(this.power_up_type.type_id === 4 && Math.abs(this.width - 2.5 * this.unscaled_width) > 0.1)
            {
                this.width = this.unscaled_width * 2.5;
            }
        }
        this.power_up_cool_down -= delta_time;
    }
    set_power_up(brick:Brick):void
    {
        this.power_up_type = brick;
        this.power_up_count_down = 10 * 1000;
    }
    use_power_up(game:Game):void
    {
        if(this.power_up_count_down > 0 && this.power_up_cool_down <= 0)
        {
            switch(this.power_up_type.type_id)
            {
                case(2):
                this.power_up_cool_down = 500;
                game.add_ball();
                game.balls[game.balls.length - 1].release();
                break;
                case(4):
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
                break;
                case(5):
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
                break;
            }
        }
    }
    draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, x: number = this.x, y: number = this.y, width: number = this.width, height: number = this.height): void {
        
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = new RGB(125 + 60*this.type_id % 256, 92*this.type_id % 256, 125*this.type_id % 256).htmlRBG();  
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
    }
}
class Game extends SquareAABBCollidable {
    collision_map:SpatialHashMap2D;
    bricks:Brick[];
    balls:Ball[];
    paddle:Paddle;
    last_dx:number;
    old_paddle_style:boolean;
    constructor(touchListener:SingleTouchListener, x:number, y:number, width:number, height:number)
    {
        super(x, y, width, height);
        this.last_dx = 0;
        this.old_paddle_style = false;
        this.bricks = [];
        this.paddle = new Paddle(width / 2 - width * 0.05, height * 0.95, width * 0.1, height * 0.05);
        this.paddle.type_id = -1;
        this.balls = [];
        this.add_ball();
        //this.bricks.push(this.paddle);
        this.init(width, height);
        touchListener.registerCallBack("touchmove", () => true, (event:TouchMoveEvent) => {
            this.last_dx = event.deltaX;
            this.paddle.target_x = event.touchPos[0];
            //this.paddle_vel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_vel_paddle() * 2;
            this.paddle.accel_x = (event.touchPos[0] - this.paddle.mid_x() > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
        });
        touchListener.registerCallBack("touchstart", () => true, (event:TouchMoveEvent) => {
            this.balls.forEach(ball => ball.release());
            this.paddle.accel_x = ((event.touchPos[0] - this.paddle.mid_x()) > 0 ? 1 : -1) * calc_x_accel_paddle() * 3;
        });
        touchListener.registerCallBack("touchend", () => true, (event:TouchMoveEvent) => {
            this.paddle.vel_x = 0;
            this.paddle.accel_x = 0;
        });
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
            brick.width = brick_width;
            brick.height = brick_height;
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
        ctx.clearRect(x, y, width, height);
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
    }
    update_state(delta_time: number): void {
        if(this.bricks.length === 1)
        {
            this.init(this.width, this.height);
        }

        for(let i = 0; i < this.balls.length; i++)
        {
            const ball = this.balls[i];
            ball.update_state(delta_time);
            const destroy_ball = ball.bounce(this.x, this.y, this.width, this.height);
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
        this.paddle.update_state_paddle(delta_time, this);
        this.collision_map = new SpatialHashMap2D(this.balls.concat([this.paddle]), this.bricks, this.width, this.height, 20, 20);
        this.collision_map.handle_by_cell( 
        (ball:SquareAABBCollidable, brick:SquareAABBCollidable) => {
            
            if((<Ball> ball).radius && brick.collides_with_circle(<Ball> ball))
            {
                const b = <Ball> ball;
                if(brick === this.paddle)
                {
                    if(b.direction[1] > 0)
                    {
                        //b.direction[1] *= -1;
                        if(this.old_paddle_style)
                        {
                            const angle = Math.round(((b.mid_x() - brick.x) / brick.width) * Math.PI * 20) / 20;
                            const mag = Math.sqrt(b.direction[0] * b.direction[0] + b.direction[1] * b.direction[1]);
                            b.direction[0] = Math.cos(angle) * mag * -1;
                            b.direction[1] = Math.sin(angle) * mag * -1;
                        }
                        else
                        {
                            b.y = brick.y - b.height;
                            b.direction[1] *= -1;
                            b.direction[0] += this.paddle.vel_x;
                        }
                        if(b.direction[1] > -120)
                            b.direction[1] += -80;
                    }
                } 

            }
        }, (a:SquareAABBCollidable, b:SquareAABBCollidable) => {
            const brick:Brick = <Brick> b;
            const ball:Ball = <Ball> a;
            if(a === this.paddle && brick.hp !== undefined && brick.hp <= 0)
            {
                const falling:Brick = <Brick> brick;
                if(falling.hp <= 0)
                {
                    const tdb_index = this.bricks.indexOf(falling);
                    (<Paddle> a).set_power_up(brick);
                    if(tdb_index >= 0)
                        this.bricks.splice(tdb_index, 1);
                }
            }
            else if(ball.radius && (brick).hp > 0 && brick !== this.paddle)
                {

                    const collision_code = brick.collides_with_circle(ball);

                    //collision code 0 no collision
                    //1 corner collision
                    //2 edge collision
                    let delta:number[];
                    if(collision_code > 0)
                    {
                        ball.hit(brick);
                        if(collision_code === 1)
                        {
                            if(ball.mid_x() < brick.mid_x())//left side
                            {
                                if(ball.mid_y() > brick.mid_y())//top left
                                {
                                    delta = [brick.x - ball.mid_x(), brick.y - ball.mid_y()];
                                }  
                                else//bottom left
                                {
                                    delta = [brick.x - ball.mid_x(), -brick.y - brick.height + ball.mid_y()];
                                }
                                
                            }
                            else
                            {
                                if(ball.mid_y() > brick.mid_y())//top right
                                {
                                    delta = [brick.x + brick.width - ball.mid_x(), brick.y - ball.mid_y()];
    
                                }  
                                else//bottom right
                                {
                                    delta = [brick.x + brick.width - ball.mid_x(), brick.y + brick.height - ball.mid_y()];
                                }
                            }
                            //invert vector to be normal vector for corner
                            delta[0] *= -1;
                            delta[1] *= -1;
                        }
                        else 
                        {
                            if(ball.mid_y() < brick.y)
                            {
                                delta = [0, -ball.radius];
                            }
                            else if(ball.mid_y() > brick.y + brick.height)
                            {
                                delta = [0, ball.radius];
                            }
                            else if(ball.mid_x() < brick.x)
                            {
                                delta = [-ball.radius, 0];
                            }
                            else
                            {
                                delta = [ball.radius, 0];
                            }
                        }
                        ball.direction = non_elastic_no_angular_momentum_bounce_vector(ball.direction, delta);
                        ball.update_state(delta_time);
                    }
                    
                }
        });
        if(this.balls.length === 0)
        {
            //this.bricks = [];
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
    let game = new Game(touchListener, 0, 0, height, width);
    window.game = game;
    //setInterval(() => {for(let i = 0; i < 200; i++) game.add_ball(); game.balls.forEach(ball => ball.release());}, 50)
    keyboardHandler.registerCallBack("keydown", () => true, (event:any) => {

        switch(event.code)
                {
                    case("Space"):
                        game.balls.forEach(ball => ball.release());
                        game.paddle.use_power_up(game);
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
    const drawLoop = () => 
    {
        //do stuff and render here
        if(getWidth() !== canvas.width || getHeight() !== canvas.height)
        {
            game.resize(getWidth(), getHeight());
            canvas.width = game.width;
            canvas.height = game.height - (isTouchSupported() ? 125 : 25);
            game.resize(canvas.width, canvas.height);
        }
        dt = Date.now() - start;
        start = Date.now();
        game.update_state(dt);
        game.draw(canvas, ctx, game.x, game.y, game.width, game.height);
        requestAnimationFrame(drawLoop);
    }
    drawLoop();

}
main();





