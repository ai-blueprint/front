/**
 * Node.js - 节点相关命令
 * 
 * 用法说明：
 *   import { selectNode, toggleSelectNode, clearSelect, createNode, deleteNode, renameNode } from './commands/Node'
 *   
 *   // 选择节点
 *   selectNode('node_123')                    // 选中单个节点
 *   selectNode(['node_123', 'node_456'])      // 选中多个节点
 *   
 *   // 切换选中
 *   toggleSelectNode('node_123')              // 切换节点的选中状态
 *   
 *   // 清空选中
 *   clearSelect()                             // 清空所有选中
 *   
 *   // 创建节点
 *   createNode('Conv2D', { x: 100, y: 100 })  // 在指定位置创建节点
 *   
 *   // 删除节点
 *   deleteNode('node_123')                    // 删除单个节点
 *   deleteNode(['node_123', 'node_456'])      // 删除多个节点
 *   
 *   // 重命名节点
 *   renameNode('node_123', '我的卷积层')       // 重命名节点
 * 
 * 核心职责：
 *   提供节点相关的所有命令，包括选中、创建、删除、重命名等
 */

import { getState, setState } from '../store'                       // 导入状态获取和设置函数
import { generateNodeId } from '../utils/generateId'                // 导入节点ID生成函数

/**
 * computeStructHash - 计算节点结构指纹
 *
 * 用法示例：
 *   const hash = computeStructHash(nodeDef)                         // 从registry节点定义生成指纹
 *
 * @param {Object} nodeDef - 节点定义，包含ports和params
 * @returns {string} - 结构指纹字符串
 */
export function computeStructHash(nodeDef) {
  const ports = nodeDef?.ports || {}                                  // 获取端口定义
  const params = nodeDef?.params || {}                                // 获取参数定义
  const inputKeys = Object.keys(ports.input || ports.in || {}).sort().join(",")  // 输入端口key排序拼接
  const outputKeys = Object.keys(ports.output || ports.out || {}).sort().join(",")  // 输出端口key排序拼接
  const paramParts = Object.keys(params).sort().map(k => {            // 参数key排序，每个拼接type
    const type = params[k]?.type || ""                                // 获取参数类型
    return `${k}:${type}`                                             // 拼接 key:type
  }).join(",")
  return `in[${inputKeys}]out[${outputKeys}]params[${paramParts}]`   // 返回完整指纹字符串
}

/**
 * findCategory - 通过opcode查找所属分类名和分类定义
 *
 * 用法示例：
 *   const { name, def } = findCategory(registry, 'input')          // 返回 { name: 'basic', def: { label: '基础', color: '#8B92E5', ... } }
 *   const { name, def } = findCategory(registry, 'unknown_node')   // 找不到时返回 { name: null, def: null }
 *   const color = findCategory(registry, 'input').def?.color        // 直接获取分类颜色
 *
 * @param {Object} registry - 节点注册表，包含categories和nodes
 * @param {string} opcode - 节点的opcode
 * @returns {{ name: string|null, def: Object|null }} - 分类名和分类定义对象
 */
function findCategory(registry, opcode) {
  const categories = registry?.categories || {}                      // 获取分类对象，防空
  const entries = Object.entries(categories)                         // 转为 [分类名, 分类定义] 的数组，方便遍历同时拿到key和value
  const found = entries.find(([, cat]) => cat.nodes?.includes(opcode))  // 找到nodes数组中包含该opcode的分类
  if (!found) return { name: null, def: null }                       // 找不到则返回空
  return { name: found[0], def: found[1] }                           // 返回分类名和分类定义对象
}

/**
 * selectNode - 选中节点
 * 
 * 用法示例：
 *   selectNode('node_123')                                        // 选中单个节点
 *   selectNode(['node_123', 'node_456'])                          // 选中多个节点
 *   selectNode('node_123', true)                                  // 追加选中（保留之前选中的）
 * 
 * @param {string|Array} nodeIdOrIds - 节点ID或ID数组
 * @param {boolean} append - 是否追加选中，默认false会替换之前的选中
 */
export function selectNode(nodeIdOrIds, append = false) {
  const { nodes } = getState()                                         // 获取当前节点列表

  const idsToAdd = Array.isArray(nodeIdOrIds)                          // 判断传入的是数组还是单个ID
    ? nodeIdOrIds                                                     // 如果是数组，直接使用
    : [nodeIdOrIds]                                                   // 如果是单个ID，包装成数组

  const addSet = new Set(idsToAdd)                                     // 转为Set提高查找效率

  const newNodes = nodes.map(n => ({                                   // 遍历所有节点设置selected
    ...n,                                                             // 保留节点其他属性
    selected: addSet.has(n.id) || (append && n.selected)              // 命中则选中，追加模式保留已选中的
  }))

  setState({ nodes: newNodes })                                        // 更新节点列表
}

/**
 * toggleSelectNode - 切换节点的选中状态
 * 
 * 用法示例：
 *   toggleSelectNode('node_123')                                  // 如果已选中则取消，否则选中
 * 
 * @param {string} nodeId - 节点ID
 */
export function toggleSelectNode(nodeId) {
  const { nodes } = getState()                                         // 获取当前节点列表

  const newNodes = nodes.map(n => {                                    // 遍历所有节点
    if (n.id !== nodeId) return n                                     // 不是目标节点，保持原样
    return { ...n, selected: !n.selected }                            // 切换目标节点的选中状态
  })

  setState({ nodes: newNodes })                                        // 更新节点列表
}

/**
 * clearSelect - 清空节点选择
 * 
 * 用法示例：
 *   clearSelect()                                                 // 清空所有选中
 */
export function clearSelect() {
  const { nodes } = getState()                                         // 获取当前节点列表
  const hasSelected = nodes.some(n => n.selected)                      // 检查是否有选中的节点
  if (!hasSelected) return                                             // 没有选中的节点，跳过更新
  const newNodes = nodes.map(n => n.selected ? { ...n, selected: false } : n)  // 取消所有节点的选中状态
  setState({ nodes: newNodes })                                        // 更新节点列表
}

/**
 * createNode - 创建节点
 * 
 * 用法示例：
 *   createNode('Conv2D')                                          // 使用默认位置创建
 *   createNode('Conv2D', { x: 100, y: 100 })                      // 在指定位置创建
 *   createNode('Conv2D', { x: 100, y: 100, name: '我的卷积' })     // 指定位置和名称
 *   createNode({ opcode: 'Conv2D', x: 100, y: 100 })              // 传入完整配置对象
 * 
 * @param {string|Object} opcodeOrConfig - 节点opcode，或包含完整配置的对象
 * @param {Object} options - 配置选项，可选
 * @returns {Object} - 返回创建的节点对象
 */
export function createNode(opcodeOrConfig, options = {}) {
  const { nodes, registry } = getState()                            // 获取当前节点列表和节点注册表

  let opcode, x, y, name, params                                    // 声明节点属性变量

  if (typeof opcodeOrConfig === 'string') {                         // 如果第一个参数是字符串（opcode）
    opcode = opcodeOrConfig                                        // 使用传入的opcode
    x = options.x ?? 100                                           // X坐标，默认100
    y = options.y ?? 100                                           // Y坐标，默认100
    name = options.name                                            // 自定义名称，可选
    params = options.params || {}                                  // 参数，可选
  } else if (typeof opcodeOrConfig === 'object') {                  // 如果是对象
    opcode = opcodeOrConfig.opcode                                 // 从对象中获取opcode
    x = opcodeOrConfig.x ?? 100                                    // X坐标，默认100
    y = opcodeOrConfig.y ?? 100                                    // Y坐标，默认100
    name = opcodeOrConfig.name                                     // 自定义名称，可选
    params = opcodeOrConfig.params || {}                           // 参数，可选
  } else {
    console.error('createNode: 参数格式错误')                       // 参数格式不正确
    return null                                                    // 返回null
  }

  const nodeDef = registry?.nodes?.[opcode]                         // 从注册表的nodes对象中获取节点定义，registry.nodes是一个对象，key是opcode

  if (!nodeDef) {                                                   // 如果找不到节点定义
    console.error('createNode: 未找到节点定义', opcode)             // 输出错误
    return null                                                    // 返回null
  }

  const nodeId = generateNodeId()                                   // 生成唯一的节点ID

  const defaultParams = {}                                          // 初始化默认参数对象
  if (nodeDef.params) {                                             // 如果节点定义中有参数
    Object.keys(nodeDef.params).forEach(key => {                   // 遍历params对象的每个key，registry中params是对象格式 { "参数名": 默认值 }
      defaultParams[key] = nodeDef.params[key]                     // 复制默认值，key是参数名，value是默认值
    })
  }

  const { name: categoryName, def: categoryDef } = findCategory(registry, opcode)  // 通过opcode查找所属分类名和分类定义

  const newNode = {                                                 // 创建新节点对象，格式需要兼容ReactFlow
    id: nodeId,                                                    // 节点ID，ReactFlow必需
    type: 'baseNode',                                              // 节点类型，对应nodeTypes中注册的类型名
    position: { x: x, y: y },                                      // 节点位置，ReactFlow要求是position对象格式
    data: {                                                        // 节点数据，ReactFlow会把data传给Node组件
      opcode: opcode,                                              // 节点opcode，用于标识节点类型
      name: name || nodeDef.label || opcode,                       // 节点显示名称，registry中用label字段
      params: { ...defaultParams, ...params },                     // 合并默认参数和传入参数
      ports: nodeDef.ports || { in: [], out: [] },                 // 端口定义，registry中格式是 { in: [], out: [] }
      category: categoryName,                                      // 节点分类名，通过findCategory从registry.categories中反查得到
      color: categoryDef?.color || '#8B92E5',                      // 节点颜色，从分类定义中获取
      structHash: computeStructHash(nodeDef)                       // 结构指纹，用于热重载后检测节点定义是否变化
    }
  }

  setState({ nodes: [...nodes, newNode] })                          // 将新节点添加到节点列表

  return newNode                                                    // 返回创建的节点
}

/**
 * deleteNode - 删除节点
 * 
 * 用法示例：
 *   deleteNode('node_123')                                        // 删除单个节点
 *   deleteNode(['node_123', 'node_456'])                          // 删除多个节点
 * 
 * @param {string|Array} nodeIdOrIds - 节点ID或ID数组
 */
export function deleteNode(nodeIdOrIds) {
  const { nodes, edges } = getState()                                  // 获取当前节点和连接线

  const idsToDelete = Array.isArray(nodeIdOrIds)                       // 判断传入的是数组还是单个ID
    ? nodeIdOrIds                                                     // 如果是数组，直接使用
    : [nodeIdOrIds]                                                   // 如果是单个ID，包装成数组

  const idSet = new Set(idsToDelete)                                   // 转换为Set，提高查找效率

  const newNodes = nodes.filter(n => !idSet.has(n.id))                 // 过滤掉要删除的节点

  const newEdges = edges.filter(e => {                                 // 过滤掉与被删除节点相关的连接线
    const sourceId = e.source                                         // ReactFlow边的起始节点ID是source字段
    const targetId = e.target                                         // ReactFlow边的目标节点ID是target字段
    return !idSet.has(sourceId) && !idSet.has(targetId)               // 只保留两端都不在删除列表中的连接线
  })

  setState({                                                           // 更新store状态
    nodes: newNodes,                                                  // 更新节点列表
    edges: newEdges,                                                  // 更新连接线列表
  })
}

/**
 * deleteSelectedNodes - 删除所有选中的节点
 * 
 * 用法示例：
 *   deleteSelectedNodes()                                         // 删除当前选中的所有节点
 */
export function deleteSelectedNodes() {
  const { nodes } = getState()                                     // 获取当前节点列表
  const selectedIds = nodes.filter(n => n.selected).map(n => n.id) // 从nodes中提取选中节点的ID
  if (selectedIds.length === 0) return                              // 如果没有选中节点，直接返回
  deleteNode(selectedIds)                                           // 删除选中的节点
}

/**
 * renameNode - 重命名节点
 * 
 * 用法示例：
 *   renameNode('node_123', '我的卷积层')                            // 重命名单个节点
 *   renameNode(['node_123', 'node_456'], '批量重命名')              // 批量重命名
 * 
 * @param {string|Array} nodeIdOrIds - 节点ID或ID数组
 * @param {string} newName - 新名称
 */
export function renameNode(nodeIdOrIds, newName) {
  if (!newName || typeof newName !== 'string') return               // 如果名称无效，直接返回

  const { nodes } = getState()                                      // 获取当前节点列表

  const idsToRename = Array.isArray(nodeIdOrIds)                    // 判断传入的是数组还是单个ID
    ? nodeIdOrIds                                                  // 如果是数组，直接使用
    : [nodeIdOrIds]                                                // 如果是单个ID，包装成数组

  const idSet = new Set(idsToRename)                                // 转换为Set，提高查找效率

  const newNodes = nodes.map(node => {                              // 遍历所有节点
    if (!idSet.has(node.id)) return node                           // 如果不在重命名列表中，保持原样
    return {                                                       // 更新节点data中的name，ReactFlow格式需要修改data对象
      ...node,                                                     // 保留节点其他属性
      data: { ...node.data, name: newName }                        // 更新data中的name字段
    }
  })

  setState({ nodes: newNodes })                                     // 更新节点列表
}

/**
 * updateNodeParam - 更新节点参数
 * 
 * 用法示例：
 *   updateNodeParam('node_123', 'kernel_size', 3)                 // 更新单个参数
 *   updateNodeParam('node_123', { kernel_size: 3, stride: 1 })    // 更新多个参数
 * 
 * @param {string} nodeId - 节点ID
 * @param {string|Object} nameOrParams - 参数名或参数对象
 * @param {any} value - 参数值（当第二个参数是字符串时使用）
 */
export function updateNodeParam(nodeId, nameOrParams, value) {
  const { nodes } = getState()                                      // 获取当前节点列表

  const node = nodes.find(n => n.id === nodeId)                     // 查找目标节点
  if (!node) return                                                 // 如果节点不存在，直接返回

  let newParams = { ...(node.data?.params || {}) }                  // 复制当前参数，ReactFlow格式中params在data里面

  if (typeof nameOrParams === 'string') {                           // 如果是单个参数更新
    newParams[nameOrParams] = value                                // 更新指定参数
  } else if (typeof nameOrParams === 'object') {                    // 如果是批量参数更新
    newParams = { ...newParams, ...nameOrParams }                  // 合并参数
  }

  const newNodes = nodes.map(n => {                                 // 遍历所有节点
    if (n.id !== nodeId) return n                                  // 如果不是目标节点，保持原样
    return {                                                       // 更新节点data中的params，ReactFlow格式
      ...n,                                                        // 保留节点其他属性
      data: { ...n.data, params: newParams }                       // 更新data中的params字段
    }
  })

  setState({ nodes: newNodes })                                     // 更新节点列表
}

/**
 * moveNode - 移动节点
 *
 * 用法示例：
 *   moveNode('node_123', 100, 200)                                // 移动到指定位置
 *   moveNode('node_123', { x: 100, y: 200 })                      // 使用对象格式
 *
 * @param {string} nodeId - 节点ID
 * @param {number|Object} xOrPos - X坐标或位置对象
 * @param {number} y - Y坐标（当第二个参数是数字时使用）
 */
export function moveNode(nodeId, xOrPos, y) {
  const { nodes } = getState()                                      // 获取当前节点列表

  let newX, newY                                                    // 声明新坐标变量

  if (typeof xOrPos === 'number') {                                 // 如果是数字
    newX = xOrPos                                                  // 直接使用作为X坐标
    newY = y                                                       // 第三个参数作为Y坐标
  } else if (typeof xOrPos === 'object') {                          // 如果是对象
    newX = xOrPos.x                                                // 从对象中获取X坐标
    newY = xOrPos.y                                                // 从对象中获取Y坐标
  } else {
    return                                                         // 参数格式不正确，直接返回
  }

  const newNodes = nodes.map(n => {                                 // 遍历所有节点
    if (n.id !== nodeId) return n                                  // 如果不是目标节点，保持原样
    return {                                                       // 更新节点position，ReactFlow格式
      ...n,                                                        // 保留节点其他属性
      position: { x: newX, y: newY }                               // ReactFlow要求位置是position对象格式
    }
  })

  setState({ nodes: newNodes })                                     // 更新节点列表
}

/**
 * getNodeById - 根据ID获取节点
 * 
 * 用法示例：
 *   const node = getNodeById('node_123')                          // 获取节点对象
 * 
 * @param {string} nodeId - 节点ID
 * @returns {Object|null} - 返回节点对象，不存在则返回null
 */
export function getNodeById(nodeId) {
  const { nodes } = getState()                                      // 获取当前节点列表
  return nodes.find(n => n.id === nodeId) || null                   // 查找并返回节点
}

/**
 * getSelectedNodes - 获取所有选中的节点
 * 
 * 用法示例：
 *   const selected = getSelectedNodes()                           // 获取选中的节点数组
 * 
 * @returns {Array} - 返回选中的节点数组
 */
export function getSelectedNodes() {
  const { nodes } = getState()                                      // 获取节点列表
  return nodes.filter(n => n.selected)                              // 返回选中的节点
}
