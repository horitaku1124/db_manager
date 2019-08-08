package com.github.horitaku1124.db_manager.controller

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseBody
import java.util.*
import javax.sql.DataSource


@Controller
class TopController {
  private val logger = LoggerFactory.getLogger(TopController::class.java)

  @Autowired
  private lateinit var dataSource: DataSource

  @RequestMapping("/")
  fun index() :String{
    return "index";
  }
  @RequestMapping("/manage")
  fun manage(model: Map<String, Any>) :String{
    return "manage";
  }

  @RequestMapping("/query", produces = ["application/json"])
  @ResponseBody
  fun query(model: Map<String, Any>,
            @RequestParam("sql") sql: String) :Map<String, Any>{
    logger.info("sql=$sql")
    var conn = dataSource.connection
    val statement = conn.prepareStatement(sql)
    statement.execute()
    val rs = statement.resultSet
    var columnCount = rs.metaData.columnCount;
    val header = ArrayList<String>()
    for (i in 1..columnCount) {
      header.add(rs.metaData.getColumnName(i))
    }
    val allData = ArrayList<List<String>>()
    var map = mutableMapOf<String, Any>()
    while (rs.next()) {
      val cols = ArrayList<String>()
      for (i in 1..columnCount) {
        cols.add(rs.getString(i))
      }
      allData.add(cols)
    }
    map["head"] = header
    map["body"] = allData
    return map;
  }
}