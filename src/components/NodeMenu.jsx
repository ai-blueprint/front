/**
 * NodeMenu.jsx - 节点菜单组件
 * 
 * 用法说明：
 *   在Blueprint组件中渲染，当右键点击节点时显示
 *   <NodeMenu />
 * 
 * 组件职责：
 *   1. 显示节点右键菜单（开发目标.txt第28-31行）
 *   2. 提供复制并粘贴、重命名、删除节点三个功能
 *   3. 跟随绑定的节点位置显示
 * 
 * 菜单项（开发目标.txt第28-31行）：
 *   - 复制并粘贴
 *   - 重命名
 *   - 删除节点
 */

import { useStore, setState } from "../store"                    // 导入store的hook和状态设置函数
import { useReactFlow } from "@xyflow/react"                      // 导入ReactFlow的hook获取坐标转换函数
import { computeStructHash } from "../commands/Node"              // 导入结构指纹计算函数
import copyPasteIcon from "../assets/ContextMenu/copy-paste.svg"  // 导入复制粘贴图标
import deleteIcon from "../assets/ContextMenu/delete-node.svg"    // 导入删除节点图标
import renameIcon from "../assets/ContextMenu/rename.svg"         // 导入重命名图标
import syncIcon from "../assets/ContextMenu/sync.svg"             // 导入同步定义图标
import "../styles/NodeMenu.css"                                   // 导入节点菜单样式

// ========== 菜单项组件 ==========

/**
 * MenuItem - 菜单项组件
 * 
 * 用法示例：
 *   <MenuItem icon={iconUrl} label="操作名" onClick={handleClick} />
 * 
 * 参数说明：
 *   icon - 图标路径
 *   label - 菜单项文字
 *   onClick - 点击回调函数
 */
const MenuItem = ({ icon, label, onClick }) => {                  // 菜单项组件，接收icon、label、onClick三个参数

  const handleClick = (e) => {                                   // 处理点击事件
    e.stopPropagation()                                           // 阻止事件冒泡，防止触发画布的点击事件
    if (onClick) onClick()                                        // 如果有回调函数则执行
    hideMenu()                                                    // 点击后隐藏菜单
  }

  return (                                                        // 返回菜单项JSX结构
    <div className="node-menu-item" onClick={handleClick}>
      <div className="icon-container">
        <img src={icon} alt={label} className="menu-icon" />
      </div>
      <span className="menu-label">{label}</span>
    </div>
  )
}

// ========== 隐藏菜单函数 ==========

/**
 * hideMenu - 隐藏节点菜单
 * 
 * 用法示例：
 *   hideMenu()
 */
const hideMenu = () => {                                          // 隐藏节点菜单的函数
  setState({ nodeMenu: { visible: false, nodeId: null } })        // 设置菜单不可见并清空绑定的节点id
}

// ========== 计算菜单位置样式 ==========

/**
 * calcPositionStyle - 计算菜单定位样式
 * 
 * 用法示例：
 *   calcPositionStyle(100, 200, 1.5)
 * 
 * 参数说明：
 *   x - 菜单X坐标
 *   y - 菜单Y坐标
 *   scale - 缩放比例
 */
const calcPositionStyle = (x, y, scale) => {                      // 计算定位样式，接收x、y坐标和缩放比例
  return {                                                        // 返回样式对象
    left: x,                                                      // 左边距
    top: y,                                                       // 上边距
    transform: `translate(-50%, -100%) scale(${scale})`,          // 水平居中 + 向上偏移 + 缩放
    transformOrigin: "center bottom"                              // 缩放原点在底部中心
  }
}

// ========== 计算节点周围位置 ==========

/**
 * calcPositionAroundNode - 计算节点周围的菜单位置
 * 
 * 用法示例：
 *   calcPositionAroundNode(node, flowToScreen, 1.0)
 * 
 * 参数说明：
 *   node - 节点对象
 *   flowToScreen - 画布坐标转屏幕坐标的函数
 *   zoom - 缩放比例
 */
const calcPositionAroundNode = (node, flowToScreen, zoom) => {    // 计算节点周围位置，接收节点、转换函数、缩放比例
  const nodeX = node.position?.x || 0                             // 获取节点X坐标，默认0
  const nodeY = node.position?.y || 0                             // 获取节点Y坐标，默认0
  const nodeWidth = node.measured?.width || 200                   // 获取节点宽度，默认200
  const nodeHeight = node.measured?.height || 60                  // 获取节点高度，默认60
  const centerX = nodeX                           // 计算节点中心X坐标
  const topY = nodeY - nodeHeight                                  // 计算节点顶部上方Y坐标，留出10像素间距
  const screenPos = flowToScreen({ x: centerX, y: topY })         // 将画布坐标转换为屏幕坐标
  return screenPos                                                // 返回屏幕坐标
}

// ========== 节点菜单主组件 ==========

/**
 * NodeMenu - 节点菜单组件
 * 
 * 用法示例：
 *   <NodeMenu />
 * 
 * 功能说明：
 *   从store读取nodeMenu状态，当visible为true时显示菜单
 *   菜单位置跟随绑定的节点
 */
const NodeMenu = () => {                                          // 节点菜单主组件

  const { visible, nodeId } = useStore(s => s.nodeMenu)           // 从store获取菜单可见状态和绑定的节点id
  const nodes = useStore(s => s.nodes)                            // 从store获取所有节点
  const edges = useStore(s => s.edges)                            // 从store获取所有连线
  const viewport = useStore(s => s.viewport)                      // 从store获取视口状态
  const registry = useStore(s => s.registry)                      // 从store获取最新registry
  const { flowToScreenPosition } = useReactFlow()                 // 从ReactFlow获取坐标转换函数

  if (!visible) return null                                       // 如果菜单不可见则不渲染
  if (!nodeId) return null                                        // 如果没有绑定节点则不渲染

  const targetNode = nodes.find(n => n.id === nodeId)             // 查找绑定的目标节点
  if (!targetNode) return null                                    // 如果找不到节点则不渲染

  const menuPos = calcPositionAroundNode(                         // 计算菜单位置
    targetNode,                                                   // 传入目标节点
    flowToScreenPosition,                                         // 传入坐标转换函数
    viewport.zoom                                                 // 传入缩放比例
  )
  const posStyle = calcPositionStyle(                             // 计算定位样式
    menuPos.x,                                                    // 传入X坐标
    menuPos.y,                                                    // 传入Y坐标
    viewport.zoom                                                 // 传入缩放比例
  )

  // ========== 菜单项点击处理 ==========

  const handleCopyAndPaste = () => {                              // 处理复制并粘贴（开发目标.txt第29行：复制并粘贴）
    window.cmd.copyAndPaste()                                     // 调用全局命令：复制并粘贴
  }

  const handleRename = () => {                                    // 处理重命名（开发目标.txt第30行：重命名）
    const node = nodes.find(n => n.id === nodeId)                 // 查找当前节点
    const currentLabel = node?.data?.label || ""                  // 获取当前节点名称
    setState({                                                    // 设置重命名弹窗状态
      renameModal: {                                              // 打开重命名弹窗
        visible: true,                                            // 显示弹窗
        nodeIds: [nodeId],                                        // 要重命名的节点id数组
        placeholder: currentLabel,                                // 占位符为当前名称
        value: currentLabel                                       // 输入框初始值为当前名称
      }
    })
  }

  const handleDelete = () => {                                    // 处理删除节点（开发目标.txt第31行：删除节点）
    window.cmd.deleteSelectedNodes()                             // 调用全局命令：删除所有选中的节点
  }

  // ========== 同步定义逻辑 ==========

  const targetNodeData = targetNode?.data                          // 获取目标节点data
  const latestDef = registry?.nodes?.[targetNodeData?.opcode]      // 从registry取最新定义
  const isDeleted = !latestDef                                     // opcode是否已删除
  const isStale = isDeleted || (targetNodeData?.structHash && computeStructHash(latestDef) !== targetNodeData.structHash)  // 是否过时
  const showSync = isStale && !isDeleted                           // 仅过时且opcode存在时显示同步按钮

  const handleSync = () => {                                       // 处理同步定义
    const newPorts = latestDef.ports || { in: [], out: [] }        // 最新端口定义
    const newParams = latestDef.params || {}                       // 最新参数定义
    const newStructHash = computeStructHash(latestDef)             // 最新结构指纹

    const newNodes = nodes.map(n => {                              // 遍历所有节点
      if (n.id !== nodeId) return n                                // 不是目标节点，保持原样
      return { ...n, data: { ...n.data, ports: newPorts, params: newParams, structHash: newStructHash } }  // 覆盖ports/params/structHash
    })

    const allPortKeys = new Set()                                  // 收集新端口所有key
    const inp = newPorts.input || newPorts.in || {}                // 输入端口
    const outp = newPorts.output || newPorts.out || {}             // 输出端口
    Object.keys(inp).forEach(k => allPortKeys.add(k))             // 添加输入端口key
    Object.keys(outp).forEach(k => allPortKeys.add(k))            // 添加输出端口key

    const newEdges = edges.filter(e => {                           // 清理断裂连线
      if (e.source === nodeId && !allPortKeys.has(e.sourceHandle)) return false  // 源端口不存在
      if (e.target === nodeId && !allPortKeys.has(e.targetHandle)) return false  // 目标端口不存在
      return true                                                  // 保留
    })

    setState({ nodes: newNodes, edges: newEdges })                 // 更新store
  }

  // ========== 渲染菜单 ==========

  return (                                                        // 返回节点菜单JSX结构
    <div id="node-menu" className="node-menu" style={posStyle}>
      <MenuItem                                                   // 复制并粘贴菜单项
        icon={copyPasteIcon}                                      // 复制粘贴图标
        label="复制粘贴"                                           // 菜单项文字
        onClick={handleCopyAndPaste}                              // 点击回调
      />
      <MenuItem                                                   // 重命名菜单项
        icon={renameIcon}                                         // 重命名图标
        label="重命名"                                             // 菜单项文字
        onClick={handleRename}                                    // 点击回调
      />
      <MenuItem                                                   // 删除节点菜单项
        icon={deleteIcon}                                         // 删除图标
        label="删除节点"                                           // 菜单项文字
        onClick={handleDelete}                                    // 点击回调
      />
      {showSync && (                                               // 仅过时且opcode存在时显示同步按钮
        <MenuItem
          icon={syncIcon}                                          // 同步图标
          label="同步定义"                                          // 菜单项文字
          onClick={handleSync}                                     // 点击回调
        />
      )}
    </div>
  )
}

export default NodeMenu                                           // 导出节点菜单组件
