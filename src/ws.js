/**
 * ws.js - WebSocket通信模块
 * 
 * 用法说明：
 *   import ws from './ws'
 *   
 *   // 连接服务器
 *   await ws.connect()
 *   
 *   // 获取节点数据
 *   await ws.getRegistry()
 *   
 *   // 运行蓝图
 *   await ws.runBlueprint()
 * 
 * 核心职责：
 *   WebSocket通信
 *     从后端获取节点数据
 *     发送蓝图数据运行
 *     收到消息输出到控制台
 */

import { getState, setState } from './store'                        // 导入状态获取和设置函数

const WS_URL = 'ws://localhost:8765'                                // WebSocket服务器地址
const TIMEOUT = 30000                                               // 请求超时时间，30秒

/**
 * WebSocket管理器类
 * 
 * 封装WebSocket连接和通信逻辑
 */
class WsManager {
  constructor() {
    this.ws = null                                                  // WebSocket实例
    this.connected = false                                          // 连接状态
    this.connecting = false                                         // 正在连接标志
    this.msgId = 0                                                  // 消息ID计数器
    this.pending = new Map()                                        // 待处理的请求映射表
  }

  /**
   * genMsgId - 生成唯一消息ID
   * 
   * 用法示例：
   *   const id = this.genMsgId()                                  // 生成类似 "msg-1-1234567890"
   * 
   * @returns {string} - 消息ID
   */
  genMsgId() {
    this.msgId += 1                                                 // 消息计数器加1
    return `msg-${this.msgId}-${Date.now()}`                       // 返回 "msg-计数-时间戳" 格式
  }

  /**
   * connect - 连接WebSocket服务器
   * 
   * 用法示例：
   *   await ws.connect()                                          // 连接服务器
   * 
   * @returns {Promise} - 连接成功返回resolve，失败返回reject
   */
  connect() {
    return new Promise((resolve, reject) => {                       // 返回Promise，支持await

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {       // 如果已经连接
        resolve()                                                  // 直接返回成功
        return
      }

      if (this.connecting) {                                        // 如果正在连接中
        reject(new Error('正在连接中，请稍候'))                     // 返回错误
        return
      }

      this.connecting = true                                        // 设置正在连接标志
      console.log('🔌 正在连接WebSocket服务器...')                  // 输出连接提示

      const socket = new WebSocket(WS_URL)                          // 创建WebSocket实例

      socket.onopen = () => {                                       // 连接成功回调
        console.log('✅ WebSocket连接成功')                        // 输出成功提示
        this.ws = socket                                           // 保存socket实例
        this.connected = true                                      // 设置连接状态
        this.connecting = false                                    // 清除正在连接标志
        resolve()                                                  // 返回成功
      }

      socket.onerror = (err) => {                                   // 连接错误回调
        console.error('❌ WebSocket连接错误:', err)                // 输出错误信息
        this.connecting = false                                    // 清除正在连接标志
        this.connected = false                                     // 设置未连接状态
        reject(new Error('WebSocket连接失败，请确保后端已启动'))    // 返回错误
      }

      socket.onclose = () => {                                      // 连接关闭回调
        console.log('🔌 WebSocket连接已关闭')                      // 输出关闭提示
        this.ws = null                                             // 清除socket实例
        this.connected = false                                     // 设置未连接状态
        this.connecting = false                                    // 清除正在连接标志
      }

      socket.onmessage = (event) => {                               // 收到消息回调
        try {
          const data = JSON.parse(event.data)                      // 解析JSON数据
          this.handleMsg(data)                                     // 处理消息
        } catch (e) {
          console.error('解析消息失败:', e)                        // 输出解析错误
        }
      }
    })
  }

  /**
   * handleMsg - 处理收到的消息
   * 
   * 用法示例：
   *   this.handleMsg(data)                                        // 内部调用，处理服务器消息
   * 
   * @param {Object} data - 服务器发来的消息对象
   */
  handleMsg(data) {
    console.log('📥 收到消息:', data.type, data)                    // 输出收到的消息

    if (data.type === 'registryUpdated') {                              // 如果是热重载推送的注册表更新
      setState({ registry: data.data })                                // 更新store中的注册表，Sidebar自动响应
      return
    }

    if (data.type === 'getRegistry') {                                 // 如果是节点注册表响应
      const pending = this.pending.get(data.id)                    // 获取对应的待处理请求
      if (pending) {                                               // 如果存在
        pending.resolve(data.data)                                 // 返回数据
        this.pending.delete(data.id)                               // 删除待处理请求
      }
      return
    }

    if (data.type === 'nodeResult') {                              // 如果是节点执行结果
      const { nodeId, output } = data.data                         // 解构节点ID和输出
      console.log(`📦 节点执行完成: ${nodeId}`)                    // 输出节点执行信息
      if (output) {                                                // 如果有输出
        Object.entries(output).forEach(([port, val]) => {          // 遍历输出端口
          if (val?.type === 'tensor') {                            // 如果是张量类型
            console.log(`   ${port}: shape=${JSON.stringify(val.shape)}`)
          } else {
            console.log(`   ${port}:`, val)                        // 输出其他类型的值
          }
        })
      }
      return
    }

    if (data.type === 'blueprintComplete') {                       // 如果是执行完成
      console.log('✅ 蓝图执行完成！')                             // 输出完成提示
      console.log(`   成功: ${data.data.success}`)                 // 输出执行结果
      const pending = this.pending.get(data.id)                    // 获取对应的待处理请求
      if (pending) {                                               // 如果存在
        pending.resolve(data.data)                                 // 返回数据
        this.pending.delete(data.id)                               // 删除待处理请求
      }
      return
    }

    if (data.type === 'nodeError') {                                    // 如果是错误消息
      console.error('❌ 执行出错:', data.data.message)             // 输出错误信息
      const pending = this.pending.get(data.id)                    // 获取对应的待处理请求
      if (pending) {                                               // 如果存在
        pending.reject(new Error(data.data.message))               // 返回错误
        this.pending.delete(data.id)                               // 删除待处理请求
      }
    }
  }

  /**
   * send - 发送消息到服务器
   * 
   * 用法示例：
   *   const result = await ws.send({ type: 'getRegistry' })
   * 
   * @param {Object} msg - 要发送的消息对象
   * @returns {Promise} - 返回服务器响应
   */
  async send(msg) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {        // 如果未连接
      await this.connect()                                         // 先连接
    }

    return new Promise((resolve, reject) => {                       // 返回Promise

      const msgId = msg.id || this.genMsgId()                      // 获取或生成消息ID
      const fullMsg = { ...msg, id: msgId }                        // 组装完整消息

      const timer = setTimeout(() => {                             // 设置超时定时器
        if (this.pending.has(msgId)) {                             // 如果请求还在等待
          this.pending.delete(msgId)                               // 删除待处理请求
          reject(new Error('请求超时'))                            // 返回超时错误
        }
      }, TIMEOUT)

      this.pending.set(msgId, {                                    // 存储待处理请求
        resolve: (data) => {                                       // 成功回调
          clearTimeout(timer)                                      // 清除超时定时器
          resolve(data)                                            // 返回数据
        },
        reject: (err) => {                                         // 失败回调
          clearTimeout(timer)                                      // 清除超时定时器
          reject(err)                                              // 返回错误
        }
      })

      console.log('📤 发送消息:', fullMsg)                         // 输出发送的消息
      this.ws.send(JSON.stringify(fullMsg))                        // 发送JSON字符串
    })
  }

  /**
   * getRegistry - 从后端获取节点数据
   * 
   * 用法示例：
   *   await ws.getRegistry()                                      // 获取节点注册表并更新store
   * 
   * @returns {Promise} - 返回节点注册表数据
   */
  async getRegistry() {
    console.log('\n' + '='.repeat(50))                              // 输出分隔线
    console.log('     获取节点注册表')                              // 输出标题
    console.log('='.repeat(50))                                     // 输出分隔线

    try {
      const result = await this.send({ type: 'getRegistry' })     // 发送获取注册表请求

      console.log('📥 收到注册表数据:')                            // 输出接收提示
      const categories = result.categories || {}                   // 获取分类数据
      const nodes = result.nodes || {}                             // 获取节点数据
      console.log(`   分类数量: ${Object.keys(categories).length}`)// 输出分类数量
      console.log(`   节点数量: ${Object.keys(nodes).length}`)     // 输出节点数量
      console.log('='.repeat(50) + '\n')                           // 输出分隔线

      setState({ registry: result })                             // 更新store中的注册表

      return result                                                // 返回原始数据
    } catch (err) {
      console.error('获取注册表失败:', err.message)                // 输出错误信息
      throw err                                                    // 抛出错误
    }
  }

  /**
   * runBlueprint - 发送蓝图数据运行
   * 
   * 用法示例：
   *   await ws.runBlueprint()                                     // 运行当前蓝图
   *   await ws.runBlueprint(customBlueprint)                      // 运行指定蓝图
   *   await ws.runBlueprint(blueprint, { input: data })           // 带输入数据运行
   * 
   * @param {Object} blueprint - 蓝图数据，可选，默认使用store中的数据
   * @param {Object} inputs - 输入数据，可选
   * @returns {Promise} - 返回执行结果
   */
  async runBlueprint(blueprint) {
    console.log('\n' + '='.repeat(50))                              // 输出分隔线
    console.log('     运行蓝图')                                    // 输出标题
    console.log('='.repeat(50))                                     // 输出分隔线

    const bp = blueprint || {                                       // 使用传入的蓝图或从store获取
      nodes: getState().nodes,                                     // 获取节点数据
      edges: getState().edges                                      // 获取连接线数据
    }
    console.log(bp);
    

    console.log(`   节点数量: ${bp.nodes?.length || 0}`)           // 输出节点数量
    console.log(`   连线数量: ${bp.edges?.length || 0}`)           // 输出连线数量

    try {
      const result = await this.send({                             // 发送运行蓝图请求
        type: 'runBlueprint',                                     // 消息类型
        data: {                                                    // 消息数据
          blueprint: bp,                                           // 蓝图数据
        }
      })

      console.log('='.repeat(50) + '\n')                           // 输出分隔线
      return result                                                // 返回执行结果
    } catch (err) {
      console.error('运行蓝图失败:', err.message)                  // 输出错误信息
      throw err                                                    // 抛出错误
    }
  }

  /**
   * disconnect - 断开连接
   * 
   * 用法示例：
   *   ws.disconnect()                                             // 断开WebSocket连接
   */
  disconnect() {
    if (this.ws) {                                                  // 如果有连接
      this.ws.close()                                              // 关闭连接
      this.ws = null                                               // 清除实例
    }
    this.connected = false                                          // 设置未连接状态
    this.pending.clear()                                            // 清空待处理请求
  }

  /**
   * isConnected - 获取连接状态
   * 
   * 用法示例：
   *   if (ws.isConnected()) { ... }                               // 检查是否已连接
   * 
   * @returns {boolean} - 是否已连接
   */
  isConnected() {
    return this.connected                                           // 返回连接状态
  }
}

const ws = new WsManager()                                          // 创建WebSocket管理器单例

export default ws                                                   // 默认导出管理器实例
