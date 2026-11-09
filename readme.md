# V2 适老预约挂号原型

这是「可用性研究与测试」课程的交互原型，以浙大二院的挂号流程为参考，用于观察首次就诊者在选号、验证、建档和确认预约时的操作表现。预约、短信和号源均为模拟，请使用虚拟资料。

[在线演示](https://hospital-ux-test.yanyangheng.com/?mode=debug&page=home)

## 快速开始

在线演示默认进入调试模式。可从首页走完整个预约流程，也可通过下方的地址参数直达指定页面。

本地运行需要 Python 3，后端仅使用标准库。

```sh
git clone https://github.com/YanYangheng/accessible-hospital-booking.git
cd accessible-hospital-booking
python3 server.py
```

启动后打开 [测试入口](http://127.0.0.1:8767/) 或 [本地调试入口](http://127.0.0.1:8767/?mode=debug&page=home)。同一局域网中的设备可用服务器 IP 加端口 `8767` 访问。页面适配手机竖屏，宽屏中显示居中的手机画布。

## 预约流程

选择院区和科室 → 按医生或按日期选号 → 选择时段 → 手机验证 → 选择建档方式 → 核对并提交预约。提交后，可在「我的预约」查看结果。

- 手机号可用 `13800000000`，验证码接受任意六位数字。
- 在线建档时填写虚拟资料，原型会校验身份证号码格式和校验码。
- 选择线下人工建档时，可以先提交预约。确认页与成功页会显示提前一小时到院建档的提醒。

## 测试入口与地址参数

| 路径或参数 | 用途 |
| --- | --- |
| `/` | 打开测试封面，填写测试用名后开始记录，也可继续同一浏览器保存的进度。 |
| `/?mode=debug&page=home` | 进入调试模式，从首页体验流程。 |
| `/?mode=debug&page=archive` | 使用示例资料打开建档页。 |
| `/?mode=debug&page=confirm&random=1` | 随机选取可预约的医生和时段，打开确认页。 |
| `/?expiry=1` | 模拟建档完成时原号源失效，并提示查看同科室其他号源。 |
| `/?delay=1` | 模拟首次短信未收到，等待 30 秒后可重发。 |
| `/?mode=test&skip_cover=1&test_id=P03&name=TestUser` | 服务端核对测试编号和测试用名后跳过封面。 |

调试入口会清除当前站点保存的测试进度。调试期间，原型不上传操作日志或预约表单。

## 测试记录

正式测试将会话、挂号尝试、操作事件和最终提交保存到本地 SQLite 数据库 `data/study.sqlite3`。其中 `events` 按会话与顺序号记录页面访问、点击和校验结果，`submissions` 保存最终预约及建档方式。已提交表单包含原始字段值，请使用测试资料。

原型用浏览器本地存储恢复进度，并在中断后尽力补传日志。继续测试时请使用同一浏览器和访问地址。数据库目录 `data/` 已加入 Git 忽略规则。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| [`index.html`](index.html)、[`style.css`](style.css) | 页面入口和样式 |
| [`app.js`](app.js)、[`startup.js`](startup.js) | 预约流程、导航与测试入口 |
| [`booking-data.js`](booking-data.js)、[`regions.js`](regions.js) | 预约配置、模拟排班和行政区划数据 |
| [`telemetry.js`](telemetry.js)、[`server.py`](server.py) | 测试记录、恢复与后端服务 |
| [`assets/`](assets/) | 医生头像、院区建档指引与其他界面素材 |
| [`tests/`](tests/) | 前后端回归测试 |

区划数据的许可见 [区划数据许可](区划数据许可.txt)。

## 运行测试

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.test.cjs
```

## Nginx 反向代理

Nginx 与 Python 同机部署时，可让后端监听回环地址，并仅信任指定代理传入的客户端地址。

```sh
python3 server.py --bind 127.0.0.1 --port 8767 --trusted-proxy 127.0.0.1
```

```nginx
location / {
    proxy_pass http://127.0.0.1:8767;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

局域网直连时省略 `--trusted-proxy`。代理和后端分开部署时，填写后端实际看到的代理 IP，并限制后端端口仅允许代理访问。
