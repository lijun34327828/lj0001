function success(data = null, message = '操作成功') {
  return {
    code: 200,
    message,
    data
  };
}

function error(message = '操作失败', code = 400) {
  return {
    code,
    message,
    data: null
  };
}

function paginated(data, total, page, pageSize) {
  return {
    code: 200,
    message: '查询成功',
    data: {
      list: data,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

module.exports = {
  success,
  error,
  paginated
};
